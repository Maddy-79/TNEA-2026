import json
import os
import pandas as pd

<<<<<<< Updated upstream
# File paths
SEAT_MATRIX_FILE = (
    "GENERAL_ACADEMIC_SEAT_MATRIX_BEFORE_SPECIAL_RESERVATION_COUNSELLING_2026.csv"
)
PROVISIONAL_FILE = "PROVISION ROUND 1.csv"  # Merged R1 + R2 provisional CSV
OUTPUT_JSON = "../public/data.json"
=======
# Get the exact folder where this script is saved
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# File paths tied securely to the script's location
SEAT_MATRIX_FILE = os.path.join(SCRIPT_DIR, "SEAT_MATRIX.csv")
PROVISIONAL_FILE = os.path.join(SCRIPT_DIR, "ALLOTMENTS.csv")
OUTPUT_JSON = os.path.join(SCRIPT_DIR, "../public/data.json")
>>>>>>> Stashed changes

# 1. Read CSV files and normalize column names
df_seat = pd.read_csv(SEAT_MATRIX_FILE)
df_seat.columns = [
    c.replace("\n", " ").strip().upper() for c in df_seat.columns
]

df_prov = pd.read_csv(PROVISIONAL_FILE)
df_prov.columns = [
    c.replace("\n", " ").strip().upper() for c in df_prov.columns
]

df_seat = df_seat.dropna(how="all")
df_prov = df_prov.dropna(how="all")

# 2. Standardize data types and clean whitespace
for col in ["COLLEGE CODE", "BRANCH CODE"]:
<<<<<<< Updated upstream
    if col in df_seat.columns:
        df_seat[col] = df_seat[col].astype(str).str.strip()
    if col in df_prov.columns:
        df_prov[col] = df_prov[col].astype(str).str.strip()

if "COLLEGE NAME" in df_seat.columns:
    df_seat["COLLEGE NAME"] = df_seat["COLLEGE NAME"].astype(str).str.strip()
if "BRANCH NAME" in df_seat.columns:
    df_seat["BRANCH NAME"] = df_seat["BRANCH NAME"].astype(str).str.strip()
if "ALLOTTED COMMUNITY" in df_prov.columns:
    df_prov["ALLOTTED COMMUNITY"] = (
        df_prov["ALLOTTED COMMUNITY"].astype(str).str.strip()
    )
=======
  if col in df_seat.columns:
    df_seat[col] = df_seat[col].astype(str).str.strip()
  if col in df_prov.columns:
    df_prov[col] = df_prov[col].astype(str).str.strip()

if "COLLEGE NAME" in df_seat.columns:
  df_seat["COLLEGE NAME"] = df_seat["COLLEGE NAME"].astype(str).str.strip()
if "BRANCH NAME" in df_seat.columns:
  df_seat["BRANCH NAME"] = df_seat["BRANCH NAME"].astype(str).str.strip()
if "ALLOTTED COMMUNITY" in df_prov.columns:
  df_prov["ALLOTTED COMMUNITY"] = (
      df_prov["ALLOTTED COMMUNITY"].astype(str).str.strip().str.upper()
  )
>>>>>>> Stashed changes

df_prov["RANK"] = pd.to_numeric(df_prov["RANK"], errors="coerce")
df_prov["AGGREGATE MARK"] = pd.to_numeric(
    df_prov["AGGREGATE MARK"], errors="coerce"
)

COMMUNITIES = ["OC", "BC", "BCM", "MBC", "SC", "SCA", "ST"]
results = []

for _, row in df_seat.iterrows():
  c_code = row.get("COLLEGE CODE", "")
  c_name = row.get("COLLEGE NAME", "")
  b_code = row.get("BRANCH CODE", "")
  b_name = row.get("BRANCH NAME", "")

  prov_slice = df_prov[
      (df_prov["COLLEGE CODE"] == c_code)
      & (df_prov["BRANCH CODE"] == b_code)
  ]

  oc_students = prov_slice[
      (prov_slice["ALLOTTED COMMUNITY"] == "OC")
      & prov_slice["AGGREGATE MARK"].notna()
  ]
  avg_oc = (
      round(float(oc_students["AGGREGATE MARK"].mean()), 2)
      if not oc_students.empty
      else None
  )

  comm_data = {}
  total_seats_all = 0
  total_filled_all = 0

  for comm in COMMUNITIES:
    matching_cols = [
        col
        for col in df_seat.columns
        if col == comm
        or col.startswith(f"{comm} ")
        or col.startswith(f"{comm}_")
        or col.startswith(f"{comm}(")
    ]

    total_seats = 0
    if matching_cols:
      for m_col in matching_cols:
        val = pd.to_numeric(row.get(m_col, 0), errors="coerce")
        if pd.notna(val):
          total_seats += int(val)
    else:
      val = pd.to_numeric(row.get(comm, 0), errors="coerce")
      total_seats = int(val) if pd.notna(val) else 0

    if comm == "MBC":
      comm_allotted = prov_slice[
          prov_slice["ALLOTTED COMMUNITY"].str.contains(
              "MBC|DNC", case=False, na=False
          )
      ]
    elif comm == "BC":
      comm_allotted = prov_slice[
          prov_slice["ALLOTTED COMMUNITY"].str.contains(
              "^BC$|^BC\\b", case=False, na=False
          )
          & ~prov_slice["ALLOTTED COMMUNITY"].str.contains(
              "BCM", case=False, na=False
          )
      ]
    else:
      comm_allotted = prov_slice[
          prov_slice["ALLOTTED COMMUNITY"].str.startswith(comm, na=False)
      ]

    filled_seats = len(comm_allotted)

    total_seats_all += total_seats
    total_filled_all += filled_seats

    valid_allotted = comm_allotted.dropna(
        subset=["RANK", "AGGREGATE MARK"]
    ).sort_values(by="RANK")

<<<<<<< Updated upstream
        valid_allotted = comm_allotted.dropna(
            subset=["RANK", "AGGREGATE MARK"]
        )

        if not valid_allotted.empty:
            # Closing rank is the maximum rank number admitted (last person in)
            closing_rank = int(valid_allotted["RANK"].max())
            # Closing cutoff is the minimum aggregate mark among admitted candidates
            closing_cutoff = round(float(valid_allotted["AGGREGATE MARK"].min()), 2)
        else:
            closing_rank = None
            closing_cutoff = None

        fill_pct = (
            round((filled_seats / total_seats) * 100, 1)
            if total_seats > 0
            else 0.0
        )

        comm_data[comm] = {
            "closing_rank": closing_rank,
            "closing_cutoff": closing_cutoff,
            "filled": filled_seats,
            "total": total_seats,
            "fill_pct": fill_pct,
        }

    total_pct = (
        round((total_filled_all / total_seats_all) * 100, 1)
        if total_seats_all > 0
=======
    if not valid_allotted.empty:
      last_student = valid_allotted.iloc[-1]
      closing_rank = int(last_student["RANK"])
      closing_cutoff = round(float(last_student["AGGREGATE MARK"]), 2)
    else:
      closing_rank = None
      closing_cutoff = None

    fill_pct = (
        round((filled_seats / total_seats) * 100, 1)
        if total_seats > 0
>>>>>>> Stashed changes
        else 0.0
    )

    comm_data[comm] = {
        "closing_rank": closing_rank,
        "closing_cutoff": closing_cutoff,
        "filled": filled_seats,
        "total": total_seats,
        "fill_pct": fill_pct,
    }

  total_pct = (
      round((total_filled_all / total_seats_all) * 100, 1)
      if total_seats_all > 0
      else 0.0
  )
  comm_data["TOTAL"] = {
      "closing_rank": None,
      "closing_cutoff": None,
      "filled": total_filled_all,
      "total": total_seats_all,
      "fill_pct": total_pct,
  }

  results.append(
      {
          "college_code": c_code,
          "college_name": c_name,
          "branch_code": b_code,
          "branch_name": b_name,
          "avg_oc_cutoff": avg_oc,
          "communities": comm_data,
      }
  )

os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
  json.dump(results, f, ensure_ascii=False, indent=2)

print(f"Successfully generated {len(results)} branch rows in {OUTPUT_JSON}!")