from __future__ import annotations

import calendar
import re
from datetime import datetime

MODEL_REPO = "rule-based"
DEFAULT_TABLE = "sales"

MONTHS = {
    name.lower(): number
    for number, name in enumerate(calendar.month_name)
    if name
}

def _safe_table_name(table_name: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", table_name):
        raise ValueError("table_name must be a simple SQL identifier")
    return table_name

def _year(question: str) -> str:
    match = re.search(r"\b(20\d{2})\b", question)
    return match.group(1) if match else str(datetime.now().year)


def _month_number(question: str) -> str | None:
    lowered = question.lower()
    for name, number in MONTHS.items():
        if re.search(rf"\b{name}\b", lowered):
            return f"{number:02d}"
    return None


def _explain_sql(sql: str) -> str:
    """Return a short explanation for a supported read-only SQL statement."""
    normalized = " ".join(sql.strip().split()).lower()
    if "sum(" in normalized and "revenue" in normalized and "group by month" not in normalized:
        return "This calculates the total revenue for the selected period."
    if "avg(" in normalized and "revenue" in normalized:
        return "This calculates the average revenue for the selected period."
    if "group by month" in normalized:
        return "This groups revenue by month so the monthly trend can be viewed."
    if "order by revenue desc" in normalized:
        return "This finds the highest-revenue days."
    if "order by revenue asc" in normalized:
        return "This finds the lowest-revenue days."
    if "group by year" in normalized:
        return "This groups total revenue by year."
    return "This is a read-only revenue query over the sales data."

class NLQEngine:
    """Generate a small, auditable set of read-only sales SQL queries."""

    def __init__(
        self,
        model_repo: str = MODEL_REPO,
        database_url: str | None = None,
        table_name: str = DEFAULT_TABLE,
        device: str | None = None,
    ):
        _ = model_repo
        _ = device
        self.model_repo = MODEL_REPO
        self.table_name = _safe_table_name(table_name)
        self.database_url = database_url
        self.mode = "rule_based"

    def load_model(self) -> None:
        """Retained for compatibility; no external model is loaded."""

    def _generate_sql(self, question: str) -> str:
        question_lower = question.lower().strip()
        table = self.table_name
        year = _year(question)

        if re.search(r"\b(compare|between)\b", question_lower):
            mentioned_months = [
                f"{number:02d}"
                for name, number in MONTHS.items()
                if re.search(rf"\b{name}\b", question_lower)
            ]
            if len(mentioned_months) >= 2:
                first, second = mentioned_months[:2]
                return (
                    "SELECT strftime('%m', date) AS month, "
                    "SUM(CAST(revenue AS FLOAT)) AS total_revenue "
                    f"FROM {table} WHERE strftime('%m', date) IN "
                    f"('{first}', '{second}') AND strftime('%Y', date) = '{year}' "
                    "GROUP BY month ORDER BY month"
                )

        if re.search(r"\b(best|highest|top)\b.*\b(month|performing)\b", question_lower):
            return (
                "SELECT strftime('%m', date) AS month, "
                "SUM(CAST(revenue AS FLOAT)) AS total_revenue "
                f"FROM {table} WHERE strftime('%Y', date) = '{year}' "
                "GROUP BY month ORDER BY total_revenue DESC LIMIT 1"
            )

        if re.search(r"\b(worst|lowest|least)\b.*\b(month|performing)\b", question_lower):
            return (
                "SELECT strftime('%m', date) AS month, "
                "SUM(CAST(revenue AS FLOAT)) AS total_revenue "
                f"FROM {table} WHERE strftime('%Y', date) = '{year}' "
                "GROUP BY month ORDER BY total_revenue ASC LIMIT 1"
            )

        if re.search(r"\b(total|sum)\b.*\b(sales|revenue)\b", question_lower):
            if re.search(r"\b(all time|to date|ever|overall)\b", question_lower):
                return f"SELECT SUM(CAST(revenue AS FLOAT)) AS total_revenue FROM {table}"
            if re.search(r"\b(last|past|previous)\s+week\b|\b7\s+days?\b", question_lower):
                return (
                    f"SELECT SUM(CAST(revenue AS FLOAT)) AS total_revenue FROM {table} "
                    "WHERE date >= date('now', '-7 days')"
                )
            if re.search(r"\b(last|past|previous|this)\s+month\b|\b30\s+days?\b", question_lower):
                return (
                    f"SELECT SUM(CAST(revenue AS FLOAT)) AS total_revenue FROM {table} "
                    "WHERE date >= date('now', '-30 days')"
                )
            if re.search(r"\bthis year\b", question_lower):
                return (
                    f"SELECT SUM(CAST(revenue AS FLOAT)) AS total_revenue FROM {table} "
                    "WHERE strftime('%Y', date) = strftime('%Y', 'now')"
                )

        if re.search(r"\b(average|avg)\b", question_lower):
            date_filter = (
                " WHERE date >= date('now', '-30 days')"
                if re.search(r"\b(last|past|previous|this)\s+month\b|\b30\s+days?\b", question_lower)
                else ""
            )
            return (
                f"SELECT AVG(CAST(revenue AS FLOAT)) AS avg_daily_revenue "
                f"FROM {table}{date_filter}"
            )

        if re.search(r"\b(trend|breakdown|by month|per month)\b", question_lower):
            return (
                "SELECT strftime('%Y-%m', date) AS month, "
                "SUM(CAST(revenue AS FLOAT)) AS total_revenue "
                f"FROM {table} GROUP BY month ORDER BY month"
            )

        month_number = _month_number(question)
        if month_number and re.search(r"\b(sales|revenue|income)\b", question_lower):
            return (
                f"SELECT SUM(CAST(revenue AS FLOAT)) AS total_revenue FROM {table} "
                f"WHERE strftime('%m', date) = '{month_number}' "
                f"AND strftime('%Y', date) = '{year}'"
            )

        if re.search(r"\b(year|annual)\b", question_lower):
            return (
                "SELECT strftime('%Y', date) AS year, "
                "SUM(CAST(revenue AS FLOAT)) AS total_revenue "
                f"FROM {table} GROUP BY year ORDER BY year"
            )

        if re.search(r"\b(lowest|worst|smallest)\b.*\b(day|date|revenue)\b", question_lower):
            return f"SELECT date, revenue FROM {table} ORDER BY revenue ASC LIMIT 1"

        if re.search(r"\b(highest|best|top)\b.*\b(day|date|revenue)\b", question_lower):
            limit_match = re.search(r"\btop\s+(\d+)\b", question_lower)
            limit = int(limit_match.group(1)) if limit_match else 1
            limit = min(max(limit, 1), 20)
            return f"SELECT date, revenue FROM {table} ORDER BY revenue DESC LIMIT {limit}"

        return (
            "SELECT strftime('%Y-%m', date) AS month, "
            "SUM(CAST(revenue AS FLOAT)) AS total_revenue "
            f"FROM {table} GROUP BY month ORDER BY month"
        )

    def generate_query(self, question: str, sql: str | None = None) -> dict:
        question = question.strip() if question else ""
        if not question and not sql:
            raise ValueError("question or sql is required")

        generated_sql = sql.strip() if sql else self._generate_sql(question)
        if not re.match(r"^SELECT\b", generated_sql, re.IGNORECASE):
            raise ValueError("Only read-only SELECT queries are supported")
        if ";" in generated_sql or "--" in generated_sql or "/*" in generated_sql:
            raise ValueError("SQL must contain one read-only statement")

        return {
            "question": question or "Explain this SQL query",
            "sql": generated_sql,
            "answer": _explain_sql(generated_sql),
            "data": None,
            "mode": self.mode,
        }

_nlq_engine: NLQEngine | None = None


def get_nlq_engine(
    model_repo: str = MODEL_REPO,
    database_url: str | None = None,
    table_name: str = DEFAULT_TABLE,
) -> NLQEngine:
    global _nlq_engine
    if _nlq_engine is None or _nlq_engine.table_name != table_name:
        _nlq_engine = NLQEngine(
            model_repo=model_repo,
            database_url=database_url,
            table_name=table_name,
        )
    return _nlq_engine