from sqlalchemy import text, inspect
from utils.db import SessionLocal, engine

def ensure_safe_foreign_keys():
    """
    Automatically detect and fix all foreign keys referencing users(employee_id)
    by converting them to ON DELETE SET NULL.
    Works globally across all tables.
    """
    db = SessionLocal()
    try:
        print("🔍 Ensuring safe foreign key constraints across all tables...")

        inspector = inspect(engine)
        tables = inspector.get_table_names()

        for table in tables:
            # Skip the users table itself
            if table == "users":
                continue

            fkeys = inspector.get_foreign_keys(table)
            for fk in fkeys:
                referred_table = fk.get("referred_table")
                referred_columns = fk.get("referred_columns", [])
                constrained_columns = fk.get("constrained_columns", [])

                # Only fix if referencing users(employee_id)
                if referred_table == "users" and "employee_id" in referred_columns:
                    constraint_name = fk.get("name", None)
                    column_name = constrained_columns[0] if constrained_columns else None

                    if not column_name:
                        continue

                    print(f"🧩 Fixing FK in '{table}' → users({column_name})")

                    # Drop existing constraint safely
                    if constraint_name:
                        try:
                            db.execute(text(f"ALTER TABLE {table} DROP FOREIGN KEY {constraint_name};"))
                        except Exception:
                            pass  # Might already be gone

                    # Make column nullable
                    try:
                        db.execute(text(f"ALTER TABLE {table} MODIFY {column_name} VARCHAR(20) NULL;"))
                    except Exception:
                        pass

                    # Add new safe constraint
                    new_constraint = f"{table}_fk_users_safe"
                    db.execute(text(f"""
                        ALTER TABLE {table}
                        ADD CONSTRAINT {new_constraint}
                        FOREIGN KEY ({column_name})
                        REFERENCES users(employee_id)
                        ON DELETE SET NULL;
                    """))

        db.commit()
        print("✅ All user-linked foreign keys are now ON DELETE SET NULL.")
    except Exception as e:
        print(f"⚠️ Foreign key auto-fix skipped: {e}")
        db.rollback()
    finally:
        db.close()