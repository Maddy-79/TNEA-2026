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
    csv_files = sorted(glob.glob(os.path.join(data_dir, '*.csv')), key=lambda x: 'PROVISION' in x.upper())
    print(f"Ordered CSV files to process: {[os.path.basename(f) for f in csv_files]}")
    
    if not csv_files:
        raise FileNotFoundError("CRITICAL: No CSV files found in 'data_processing/'.")

    master_data = {}

    for f in csv_files:
        filename = os.path.basename(f).upper()
        print(f"Processing file: {filename}")
        try:
            df = pd.read_csv(f, encoding='utf-8', on_bad_lines='skip')
            print(f"Rows found: {len(df)}")
            if len(df) == 0:
                continue
            
            # --- CASE 1: PROVISIONAL ALLOTMENT FILE ---
            if 'PROVISION' in filename:
                df.columns = [str(c).strip().upper() for c in df.columns]
                c_col = next((c for c in ['COLLEGE CODE', 'INSTITUTE CODE', 'CODE'] if c in df.columns), None)
                b_col = next((c for c in ['BRANCH CODE', 'COURSE CODE', 'BRANCH'] if c in df.columns), None)
                comm_col = next((c for c in ['COMMUNITY', 'ALLOTTED COMMUNITY'] if c in df.columns), None)
                mark_col = next((c for c in ['AGGREGATE MARK', 'MARK', 'CUTOFF'] if c in df.columns), None)
                rank_col = next((c for c in ['RANK'] if c in df.columns), None)
                
                if not c_col or not b_col:
                    continue
                    
                for _, row in df.iterrows():
                    try:
                        c_code = str(row[c_col]).strip()
                        b_code = str(row[b_col]).strip()
                        if not c_code or c_code == 'NAN' or not b_code or b_code == 'NAN':
                            continue
                            
                        key = f"{c_code}_{b_code}"
                        if key not in master_data:
                            master_data[key] = {
                                "college_code": c_code,
                                "college_name": f"College {c_code}",
                                "branch_code": b_code,
                                "branch_name": f"Branch {b_code}",
                                "avg_oc_cutoff": 180.0,
                                "communities": {}
                            }
                        
                        comm = str(row[comm_col]).strip().upper() if comm_col and pd.notna(row[comm_col]) else "OC"
                        mark = float(row[mark_col]) if mark_col and pd.notna(row[mark_col]) else 180.0
                        rank = int(float(str(row[rank_col]).replace(',', ''))) if rank_col and pd.notna(row[rank_col]) else 1000
                        
                        if comm not in master_data[key]["communities"]:
                            master_data[key]["communities"][comm] = {
                                "closing_rank": rank,
                                "closing_cutoff": mark,
                                "filled": 1,
                                "total": 1,
                                "fill_pct": 100.0
                            }
                        else:
                            existing = master_data[key]["communities"][comm]
                            existing["filled"] += 1
                            existing["total"] += 1
                            if mark < existing["closing_cutoff"]:
                                existing["closing_cutoff"] = mark
                            if rank > existing["closing_rank"]:
                                existing["closing_rank"] = rank
                    except Exception:
                        continue

            # --- CASE 2: SEAT MATRIX FILE ---
            else:
                # TNEA Seat Matrix typically has columns: CODE, COLLEGE NAME, BRANCH, BRANCH NAME (or similar index positions)
                # Let's inspect raw columns, and if they are messy, fallback to positional parsing based on screenshot preview:
                # Col 0: Code, Col 1: College Name, Col 2: Branch Code, Col 3: Branch Name
                for idx, row in df.iterrows():
                    try:
                        # Convert row values to string list
                        vals = [str(val).strip() for val in row.values if pd.notna(val)]
                        if len(vals) < 4:
                            continue
                        
                        # Look for numeric college code pattern or extract from specific columns
                        potential_code = str(row.iloc[0]).strip()
                        if not potential_code.isdigit():
                            # Skip header rows
                            continue
                            
                        c_code = potential_code
                        c_name = str(row.iloc[1]).strip()
                        b_code = str(row.iloc[2]).strip()
                        b_name = str(row.iloc[3]).strip()
                        
                        if not c_code or c_code == 'nan' or not b_code or b_code == 'nan':
                            continue
                            
                        key = f"{c_code}_{b_code}"
                        if key not in master_data:
                            master_data[key] = {
                                "college_code": c_code,
                                "college_name": c_name if c_name and c_name != 'nan' else f"College {c_code}",
                                "branch_code": b_code,
                                "branch_name": b_name if b_name and b_name != 'nan' else f"Branch {b_code}",
                                "avg_oc_cutoff": 180.0,
                                "communities": {}
                            }
                        else:
                            if c_name and c_name != 'nan':
                                master_data[key]["college_name"] = c_name
                            if b_name and b_name != 'nan':
                                master_data[key]["branch_name"] = b_name
                    except Exception:
                        continue
        except Exception as e:
            print(f"Error parsing file {filename}: {e}")

    result = list(master_data.values())
    if not result:
        raise ValueError("CRITICAL: Zero records successfully compiled from files.")

    print(f"Total unique college-branch records compiled: {len(result)}")

    for item in result:
        oc_data = item["communities"].get("OC")
        if oc_data:
            item["avg_oc_cutoff"] = oc_data["closing_cutoff"]

    chunk_size = 10000
    chunks = [result[i:i + chunk_size] for i in range(0, len(result), chunk_size)]
    
    manifest = []
    for idx, chunk in enumerate(chunks):
        filename = f"data_part_{idx + 1}.json"
        output_path = os.path.join('public', filename)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(chunk, f, separators=(',', ':'))
        manifest.append(filename)
        print(f"Saved {filename} with {len(chunk)} records.")

    manifest_path = os.path.join('public', 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f)
    print("Manifest successfully generated.")

if __name__ == '__main__':
    main()
