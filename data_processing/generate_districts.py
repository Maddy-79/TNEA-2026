import os
import pandas as pd

# Get the directory of the current script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SEAT_MATRIX_FILE = os.path.join(SCRIPT_DIR, "SEAT_MATRIX.csv")
OUTPUT_DISTRICT_CSV = os.path.join(SCRIPT_DIR, "district.csv")

# Read seat matrix
df_seat = pd.read_csv(SEAT_MATRIX_FILE)
df_seat.columns = [
    c.replace("\n", " ").strip().upper() for c in df_seat.columns
]

# Extract unique colleges
if "COLLEGE CODE" in df_seat.columns and "COLLEGE NAME" in df_seat.columns:
  colleges = (
      df_seat[["COLLEGE CODE", "COLLEGE NAME"]]
      .drop_duplicates(subset=["COLLEGE CODE"])
      .copy()
  )
  colleges["COLLEGE CODE"] = colleges["COLLEGE CODE"].astype(str).str.strip()
  colleges["COLLEGE NAME"] = colleges["COLLEGE NAME"].astype(str).str.strip()

  # Common TN districts/cities for auto-detection mapping
  tn_districts = [
      "Chennai",
      "Coimbatore",
      "Madurai",
      "Tiruchirappalli",
      "Trichy",
      "Salem",
      "Tirunelveli",
      "Vellore",
      "Thanjavur",
      "Erode",
      "Namakkal",
      "Dindigul",
      "Kanchipuram",
      "Tiruvallur",
      "Chengalpattu",
      "Cuddalore",
      "Villupuram",
      "Krishnagiri",
      "Dharmapuri",
      "Karur",
      "Tiruvarur",
      "Nagapattinam",
      "Pudukkottai",
      "Sivaganga",
      "Ramanathapuram",
      "Virudhunagar",
      "Theni",
      "Thoothukudi",
      "Tuticorin",
      "Nilgiris",
      "Kanyakumari",
      "Ranipet",
      "Tirupathur",
      "Kallakurichi",
      "Tenkasi",
      "Mayiladuthurai",
      "Ariyalur",
      "Perambalur",
  ]


  def detect_district(name):
    name_upper = name.upper()
    for dist in tn_districts:
      if dist.upper() in name_upper:
        if dist.upper() == "TRICHY":
          return "Tiruchirappalli"
        if dist.upper() == "TUTICORIN":
          return "Thoothukudi"
        return dist
    return "Other"


  colleges["DISTRICT"] = colleges["COLLEGE NAME"].apply(detect_district)

  # Save to district.csv
  colleges.to_csv(OUTPUT_DISTRICT_CSV, index=False)
  print(
      f"Successfully created {OUTPUT_DISTRICT_CSV} with {len(colleges)} unique"
      " colleges!"
  )
else:
  print("Error: 'COLLEGE CODE' or 'COLLEGE NAME' columns not found!")