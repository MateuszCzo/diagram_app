import os
import time
from dotenv import load_dotenv
from sqlalchemy import create_engine, MetaData
from sqlalchemy.exc import OperationalError
from databases import Database
from .models import metadata

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

database = Database(DATABASE_URL)
engine = create_engine(DATABASE_URL)

def wait_for_db(engine, retries=10, delay=3):
    for i in range(retries):
        try:
            conn = engine.connect()
            conn.close()
            print("Połączenie z bazą danych powiodło się")
            return
        except OperationalError as e:
            print(f"Połączenie nie powiodło się ({i+1}/{retries}): {e}")
            time.sleep(delay)
    raise Exception(f"Nie udało się połączyć z bazą po {retries} próbach")

wait_for_db(engine)
print("Tabele zostały utworzone")
metadata.create_all(engine)
