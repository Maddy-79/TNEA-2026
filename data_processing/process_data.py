import os
import glob
import json
import pandas as pd

def main():
    os.makedirs('public', exist_ok=True)
    
    old_data_json = os.path.join('public', 'data.json')
    if os.path.exists(old_data_json):
        os.remove(old_data_json)

    data_dir = 'data_processing'
    csv_files = glob.glob(os.path.join(data_dir, '*.csv'))
    print(f"Found CSV files: {[os.path.basename(f) for f in csv_files]}")
    
    if not csv_files:
        raise FileNotFoundError("CRITICAL: No CSV files found in 'data_processing/'.")

    master_data = {}
    communities_list = ["OC", "BC", "BCM", "MBC", "SC", "SCA", "ST"]

    seat_matrix_file = next((f for f in csv_files if 'PROVISION' not in os.path.basename(f).upper()), None)
    prov_file = next((f for f in csv_files if 'PROVISION' in os.path.basename(f).upper()), None)

    # --- STEP 1: Parse Seat Matrix for College & Branch Names ---
    if seat_matrix_file:
        print(f"Parsing Seat Matrix: {os.path.basename(seat_matrix_file)}")
        try:
            df_sm = pd.read_csv(seat_matrix_file, encoding='utf-8', on_bad_lines='skip')
            for _, row in df_sm.iterrows():
                try:
                    vals = [str(v).strip() for v in row.values if pd.notna(v)]
                    if len(vals) < 4:
                        continue
                    c_code = str(row.iloc[0]).strip()
                    if not c_code.isdigit():
                        continue
                    c_name = str(row.iloc[1]).strip()
                    b_code = str(row.iloc[2]).strip().upper()
                    b_name = str(row.iloc[3]).strip()
                    
                    key = f"{c_code}_{b_code}"
                    master_data[key] = {
                        "college_code": c_code,
                        "college_name": c_name if c_name and c_name != 'nan' else f"College {c_code}",
                        "branch_code": b_code,
                        "branch_name": b_name if b_name and b_name != 'nan' else f"Branch {b_code}",
                        "avg_oc_cutoff": 180.0,
                        "communities": {cm: {"closing_rank": 0, "closing_cutoff": 0.0, "filled": 0, "total": 1, "fill_pct": 0.0} for cm in communities_list}
                    }
                except Exception:
                    continue
        except Exception as e:
            print(f"Error reading seat matrix: {e}")

    # --- STEP 2: Parse Provisional Allotments Strictly from CSV Rows ---
    if prov_file:
        print(f"Parsing Provisional Allotments: {os.path.basename(prov_file)}")
        try:
            df_prov = pd.read_csv(prov_file, encoding='utf-8', on_bad_lines='skip')
            cols = [str(c).strip().upper() for c in df_prov.columns]
            
            c_col = next((c for c in cols if 'COLLEGE' in c and 'CODE' in c), None)
            b_col = next((c for c in cols if 'BRANCH' in c and 'CODE' in c), None)
            comm_col = next((c for c in cols if 'COMMUNITY' in c or 'QUOTA' in c), None)
            mark_col = next((c for c in cols if 'MARK' in c or 'CUTOFF' in c), None)
            rank_col = next((c for c in cols if 'RANK' in c), None)

            for _, row in df_prov.iterrows():
                try:
                    c_code = str(row[c_col]).strip() if c_col and pd.notna(row[c_col]) else ""
                    b_code = str(row[b_col]).strip().upper() if b_col and pd.notna(row[b_col]) else ""
                    if not c_code or c_code == 'NAN' or not b_code or b_code == 'NAN':
                        continue
                    
                    key = f"{c_code}_{b_code}"
                    
                    # Read exact community from the CSV row
                    comm = "OC"
                    if comm_col and pd.notna(row[comm_col]):
                        raw_comm = str(row[comm_col]).strip().upper()
                        raw_comm = ''.join([ch for ch in raw_comm if ch.isalnum()])
                        if raw_comm in communities_list:
                            comm = raw_comm

                    mark = float(row[mark_col]) if mark_col and pd.notna(row[mark_col]) else 0.0
                    rank = int(float(str(row[rank_col]).replace(',', ''))) if rank_col and pd.notna(row[rank_col]) else 0

                    if key not in master_data:
                        master_data[key] = {
                            "college_code": c_code,
                            "college_name": f"College {c_code}",
                            "branch_code": b_code,
                            "branch_name": f"Branch {b_code}",
                            "avg_oc_cutoff": 180.0,
                            "communities": {cm: {"closing_rank": 0, "closing_cutoff": 0.0, "filled": 0, "total": 1, "fill_pct": 0.0} for cm in communities_list}
                        }

                    comm_dict = master_data[key]["communities"][comm]
                    comm_dict["filled"] += 1
                    comm_dict["total"] = max(comm_dict["total"], comm_dict["filled"])
                    
                    # Closing rank: maximum rank in the CSV for this community
                    if rank > comm_dict["closing_rank"]:
                        comm_dict["closing_rank"] = rank
                    # Closing cutoff: minimum mark in the CSV for this community
                    if comm_dict["closing_cutoff"] == 0.0 or (mark > 0 and mark < comm_dict["closing_cutoff"]):
                        comm_dict["closing_cutoff"] = mark

                except Exception:
                    continue
        except Exception as e:
            print(f"Error parsing provisional file: {e}")

    result = list(master_data.values())
    if not result:
        raise ValueError("CRITICAL: Zero records compiled.")

    for item in result:
        for comm, data in item["communities"].items():
            if data["total"] > 0:
                data["fill_pct"] = round((data["filled"] / data["total"]) * 100.0, 1)
        
        oc_data = item["communities"].get("OC")
        if oc_data and oc_data["closing_cutoff"] > 0:
            item["avg_oc_cutoff"] = oc_data["closing_cutoff"]
        else:
            item["avg_oc_cutoff"] = 180.0

    # Sort by OC closing rank ascending
    result.sort(key=lambda x: x["communities"]["OC"]["closing_rank"] if x["communities"]["OC"]["closing_rank"] > 0 else 999999)

    chunk_size = 10000
    chunks = [result[i:i + chunk_size] for i in range(0, len(result), chunk_size)]
    
    manifest = []
    for idx, chunk in enumerate(chunks):
        filename = f"data_part_{idx + 1}.json"
        output_path = os.path.join('public', filename)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(chunk, f, separators=(',', ':'))
        manifest.append(filename)

    with open(os.path.join('public', 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f)
    print("Successfully processed data chunks strictly from CSV.")

if __name__ == '__main__':
    main()
