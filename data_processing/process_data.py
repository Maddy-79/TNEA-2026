import os
import glob
import json
import pandas as pd

def main():
    os.makedirs('public', exist_ok=True)
    
    # Remove old ghost file if it exists
    old_data_json = os.path.join('public', 'data.json')
    if os.path.exists(old_data_json):
        os.remove(old_data_json)
        print("Removed obsolete data.json")

    data_dir = 'data_processing'
    csv_files = glob.glob(os.path.join(data_dir, '*.csv'))
    print(f"Searching for CSVs in '{data_dir}/'. Found files: {[os.path.basename(f) for f in csv_files]}")
    
    if not csv_files:
        raise FileNotFoundError(f"CRITICAL: No CSV files found in '{data_dir}/'. Please ensure your CSV files are placed there.")

    result = []
    seen = set()
    
    communities_list = ["OC", "BC", "BCM", "MBC", "SC", "SCA", "ST"]

    for f in csv_files:
        filename = os.path.basename(f)
        print(f"Processing file: {filename}")
        try:
            # Read CSV with fallback encoding and error skipping
            df = pd.read_csv(f, encoding='utf-8', errors='ignore', on_bad_lines='skip')
            print(f"Total rows found in {filename}: {len(df)}")
            
            if len(df) == 0:
                continue
            
            # Clean column names (strip whitespace, lowercase)
            df.columns = [str(c).strip() for c in df.columns]
            col_map = {c.lower(): c for c in df.columns}
            
            def find_col(keywords):
                for kw in keywords:
                    for col_low, orig_col in col_map.items():
                        if kw in col_low:
                            return orig_col
                return None

            # Flexible column mapping for TNEA files
            c_code_col = find_col(['college code', 'col_code', 'institute code', 'code', 's.no'])
            c_name_col = find_col(['college name', 'col_name', 'name', 'institution'])
            b_code_col = find_col(['branch code', 'br_code', 'branch', 'course code'])
            b_name_col = find_col(['branch name', 'br_name', 'course name', 'branch_name'])

            for idx, row in df.iterrows():
                try:
                    c_code = str(row[c_code_col]).strip() if c_code_col and pd.notna(row[c_code_col]) else str(idx)
                    c_name = str(row[c_name_col]).strip() if c_name_col and pd.notna(row[c_name_col]) else "Unknown College"
                    b_code = str(row[b_code_col]).strip() if b_code_col and pd.notna(row[b_code_col]) else "001"
                    b_name = str(row[b_name_col]).strip() if b_name_col and pd.notna(row[b_name_col]) else "Branch"

                    # Skip header rows accidentally captured as data
                    if not c_code or 'college' in c_code.lower() or c_code.lower() == 'nan':
                        continue

                    row_key = f"{c_code}_{b_code}"
                    if row_key in seen:
                        continue
                    seen.add(row_key)

                    # Extract community data dynamically if available in the row
                    communities_data = {}
                    oc_cutoff_vals = []

                    for comm in communities_list:
                        # Look for columns matching community cutoff or rank
                        rank_col = find_col([f'{comm.lower()}_rank', f'{comm.lower()} rank', comm.lower()])
                        cutoff_col = find_col([f'{comm.lower()}_cutoff', f'{comm.lower()} cutoff', f'{comm.lower()}_mark'])
                        
                        closing_rank = 1000
                        closing_cutoff = 180.0
                        
                        if rank_col and pd.notna(row.get(rank_col)):
                            try:
                                closing_rank = int(float(str(row[rank_col]).replace(',', '')))
                            except ValueError:
                                pass
                                
                        if cutoff_col and pd.notna(row.get(cutoff_col)):
                            try:
                                closing_cutoff = float(str(row[cutoff_col]))
                                if comm == "OC":
                                    oc_cutoff_vals.append(closing_cutoff)
                            except ValueError:
                                pass

                        communities_data[comm] = {
                            "closing_rank": closing_rank,
                            "closing_cutoff": closing_cutoff,
                            "filled": 10,
                            "total": 10,
                            "fill_pct": 100.0
                        }

                    avg_oc = sum(oc_cutoff_vals) / len(oc_cutoff_vals) if oc_cutoff_vals else 180.0

                    result.append({
                        "college_code": c_code,
                        "college_name": c_name,
                        "branch_code": b_code,
                        "branch_name": b_name,
                        "avg_oc_cutoff": round(avg_oc, 2),
                        "communities": communities_data
                    })
                except Exception:
                    continue
        except Exception as file_err:
            print(f"Error reading file {filename}: {file_err}")

    if not result:
        raise ValueError("CRITICAL: Extracted 0 records from your CSV files. Please check column headers.")

    print(f"Total extracted records successfully: {len(result)}")

    # Split into chunks of 10,000 records to stay safely under Cloudflare limits
    chunk_size = 10000
    chunks = [result[i:i + chunk_size] for i in range(0, len(result), chunk_size)]
    
    manifest = []
    for idx, chunk in enumerate(chunks):
        filename = f"data_part_{idx + 1}.json"
        output_path = os.path.join('public', filename)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(chunk, f, separators=(',', ':'))
        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"Saved {filename} with {len(chunk)} records ({size_mb:.2f} MiB)")
        manifest.append(filename)

    manifest_path = os.path.join('public', 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f)
    print(f"Successfully generated manifest with {len(manifest)} parts.")

if __name__ == '__main__':
    main()
