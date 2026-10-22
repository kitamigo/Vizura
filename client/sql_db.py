import sqlite3

conn = sqlite3.connect('sales.db')
cursor = conn.cursor()

cursor.execute('''
CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, 
        manager TEXT, 
        date TEXT,
        revenue REAL
    )
''')

data = [
    (1, 'Alice', '2023-01-01', 1000.50),
    (2, 'Bob', '2023-01-02', 750.00),
    (3, 'Charlie', '2023-01-03', 1200.75),
    (4, 'David', '2023-01-04', 950.25),
    (5, 'Eva', '2023-01-05', 1100.00)
]

cursor .executemany('INSERT INTO users VALUES (?, ?, ?, ?)', data)

conn.commit()
conn.close()