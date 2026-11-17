from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

MODEL_REPO = "lightweight-cpu-forecast"
FORECAST_HORIZON = 30
MIN_TRAINING_DAYS = 30
LOCAL_MODEL_DIR = Path("models_cache")

@dataclass
class ForecastResult:
    dates: list[str] = field(default_factory=list)
    xgboost_forecast: list[float] = field(default_factory=list)
    prophet_forecast: list[float] = field(default_factory=list)
    ensemble_forecast: list[float] = field(default_factory=list)
    lower_bound: list[float] = field(default_factory=list)
    upper_bound: list[float] = field(default_factory=list)
    xgb_weight: float = 0.5
    prophet_weight: float = 0.5
    rmse_xgb: float | None = None
    rmse_prophet: float | None = None
    metadata: dict = field(default_factory=dict)

class ForecastEnsemble:
    """Forecast using weekday seasonality, trend, and residual intervals."""

    def __init__(
        self,
        model_repo: str = MODEL_REPO,
        xgb_weight: float = 0.5,
        prophet_weight: float = 0.5,
    ):
        self.model_repo = model_repo
        self.xgb_weight = xgb_weight
        self.prophet_weight = prophet_weight
        self._last_date: pd.Timestamp | None = None
        self._values: np.ndarray | None = None
        self._dates: pd.Series | None = None
        self._weekday_means: dict[int, float] = {}
        self._trend_slope = 0.0
        self._residual_std = 0.0
        self._fitted = False
        self._rmse_xgb: float | None = None
        self._rmse_prophet: float | None = None

    def load_from_hub(self, repo: str | None = None) -> "ForecastEnsemble":
        """Retained for compatibility; this implementation has no remote model."""
        _ = repo
        return self

    def fit(
        self,
        df: pd.DataFrame,
        date_col: str = "date",
        value_col: str = "revenue",
        tune_weights: bool = True,
    ) -> "ForecastEnsemble":
        _ = tune_weights
        prepared = df[[date_col, value_col]].copy()
        prepared[date_col] = pd.to_datetime(prepared[date_col], errors="coerce")
        prepared[value_col] = pd.to_numeric(prepared[value_col], errors="coerce")
        prepared = (
            prepared.dropna()
            .groupby(date_col, as_index=False)
            .agg({value_col: "sum"})
            .sort_values(by=[date_col])
            .reset_index(drop=True)
        )

        if len(prepared) < MIN_TRAINING_DAYS:
            raise ValueError(
                f"Need at least {MIN_TRAINING_DAYS} days of data. Got {len(prepared)}."
            )

        self._dates = prepared[date_col]
        self._values = prepared[value_col].to_numpy(dtype=float)
        dates = self._dates
        values = self._values
        assert dates is not None
        assert values is not None
        self._last_date = dates.iloc[-1]

        recent_count = min(60, len(prepared))
        recent = prepared.tail(recent_count)
        weekday_means = recent.groupby(recent[date_col].dt.dayofweek)[value_col].mean().to_dict()
        self._weekday_means = {
            int(str(day)): float(value) for day, value in weekday_means.items()
        }

        trend_count = min(30, len(values))
        trend_values = values[-trend_count:]
        self._trend_slope = float(np.polyfit(np.arange(trend_count), trend_values, 1)[0])

        fitted = np.array(
            [
                self._weekday_means.get(day, float(np.mean(values)))
                for day in dates.dt.dayofweek
            ]
        )
        self._residual_std = float(np.std(values - fitted))
        self._rmse_xgb = self._rmse_prophet = self._residual_std
        self._fitted = True
        return self

    def predict(self, days: int = FORECAST_HORIZON) -> ForecastResult:
        if not self._fitted or self._last_date is None or self._values is None:
            raise RuntimeError("Model not fitted. Call .fit() first.")

        last_date = self._last_date
        values = self._values
        assert last_date is not None
        assert values is not None
        days = min(max(days, 1), 90)
        future_dates = pd.date_range(
            start=last_date + pd.Timedelta(days=1),
            periods=days,
            freq="D",
        )
        recent_mean = float(np.mean(values[-7:]))
        seasonal_forecast = []
        trend_forecast = []

        for index, date in enumerate(future_dates):
            seasonal = self._weekday_means.get(date.dayofweek, recent_mean)
            trend = recent_mean + self._trend_slope * (index + 1)
            seasonal_forecast.append(max(0.0, seasonal))
            trend_forecast.append(max(0.0, trend))

        ensemble = (
            self.xgb_weight * np.asarray(seasonal_forecast)
            + self.prophet_weight * np.asarray(trend_forecast)
        )
        interval = max(self._residual_std * 1.96, 1.0)

        return ForecastResult(
            dates=[date.strftime("%Y-%m-%d") for date in future_dates],
            xgboost_forecast=[round(value, 2) for value in seasonal_forecast],
            prophet_forecast=[round(value, 2) for value in trend_forecast],
            ensemble_forecast=[round(value, 2) for value in ensemble],
            lower_bound=[round(max(0.0, value - interval), 2) for value in ensemble],
            upper_bound=[round(value + interval, 2) for value in ensemble],
            xgb_weight=self.xgb_weight,
            prophet_weight=self.prophet_weight,
            rmse_xgb=self._rmse_xgb,
            rmse_prophet=self._rmse_prophet,
            metadata={
                "model_repo": self.model_repo,
                "method": "weekday_seasonality_and_linear_trend",
                "horizon_days": days,
                "last_training_date": self._last_date.strftime("%Y-%m-%d"),
            },
        )

    def push_to_hub(self, repo: str | None = None, token: str | None = None) -> None:
        """Prevent accidental publication of a non-persistent statistical model."""
        _ = repo
        _ = token
        raise RuntimeError("Hugging Face model publishing is not used by the CPU forecast.")

_ensemble: ForecastEnsemble | None = None

def get_forecast_ensemble(model_repo: str = MODEL_REPO) -> ForecastEnsemble:
    global _ensemble
    if _ensemble is None:
        _ensemble = ForecastEnsemble(model_repo=model_repo)
    return _ensemble