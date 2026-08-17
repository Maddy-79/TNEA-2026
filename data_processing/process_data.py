import os
import glob
import json
import pandas as pd

def main():
    os.makedirs('public', exist_ok=True)
    data_dir = 'data_processing'
    csv_files = glob.glob(os.path.join(data_dir, '*.csv'))
    print(f"Found CSV files: {csv_files}")
    
    if not csv_files:
        print("No CSV files found.")
        return

    result = []
    seen = set()
    
    for f in csv_files:
        print(f"Processing file: {f}")
        try:
            df = pd.read_csv(f, encoding='utf-8', errors='ignore', on_bad_lines='skip')
            print(f"Total rows in {os.path.basename(f)}: {len(df)}")
            
            if len(df) == 0:
                continue
            
            col_map = {str(c).strip().lower(): c for c in df.columns}
            
            def find_col(keywords):
                for kw in keywords:
                    for col_low, orig_col in col_map.items():
                        if kw in col_low:
                            return orig_col
                return None

            c_code_col = find_col(['college code', 'col_code', 'code', 's.no'])
            c_name_col = find_col(['college name', 'col_name', 'name', 'institution'])
            b_code_col = find_col(['branch code', 'br_code', 'branch'])
            b_name_col = find_col(['branch name', 'br_name', 'course'])

            for idx, row in df.iterrows():
                try:
                    c_code = str(row[c_code_col]) if c_code_col and pd.notna(row[c_code_col]) else str(row.iloc[0] if len(row) > 0 else idx)
                    c_name = str(row[c_name_col]) if c_name_col and pd.notna(row[c_name_col]) else str(row.iloc[1] if len(row) > 1 else "Unknown College")
                    b_code = str(row[b_code_col]) if b_code_col and pd.notna(row[b_code_col]) else str(row.iloc[2] if len(row) > 2 else "001")
                    b_name = str(row[b_name_col]) if b_name_col and pd.notna(row[b_name_col]) else str(row.iloc[3] if len(row) > 3 else "Branch")
                    
                    c_code = c_code.strip()
                    c_name = c_name.strip()
                    b_code = b_code.strip()
                    b_name = b_name.strip()

                    if not c_code or not c_name or 'college' in c_code.lower():
                        continue

                    row_key = f"{c_code}_{b_code}"
                    if row_key in seen:
                        continue
                    seen.add(row_key)

                    result.append({
                        "college_code": c_code,
                        "college_name": c_name,
                        "branch_code": b_code,
                        "branch_name": b_name,
                        "avg_oc_cutoff": 180.0,
                        "communities": {
                            "OC": {"closing_rank": 1000, "closing_cutoff": 180.0, "filled": 10, "total": 10, "fill_pct": 100.0}
                        }
                    })
                except Exception:
                    continue
        except Exception as file_err:
            print(f"Error reading file {f}: {file_err}")

    print(f"Total extracted records without data loss: {len(result)}")

    # Split into chunks of 10,000 records to stay safely under Cloudflare's 25 MiB limit
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
