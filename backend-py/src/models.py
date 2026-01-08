from sqlalchemy import Table, Column, String, Text, MetaData

metadata = MetaData()

projects = Table(
    "projects",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String),
    Column("snapshot", Text),
)