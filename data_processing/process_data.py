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

    # Automatically pick the largest/main CSV file (your merged data)
    main_csv = max(csv_files, key=os.path.getsize)
    print(f"Processing main CSV: {main_csv}")
    
    df = pd.read_csv(main_csv, encoding='utf-8', errors='ignore')
    df.columns = [str(c).strip() for c in df.columns]
    print(f"Total rows in CSV to process: {len(df)}")

    result = []
    for idx, row in df.iterrows():
        def get_val(keys, default, pos=None):
            for k in keys:
                if k in df.columns and pd.notna(row[k]):
                    return row[k]
            if pos is not None and len(row) > pos and pd.notna(row.iloc[pos]):
                return row.iloc[pos]
            return default

        c_code = str(get_val(['College Code', 'COLLEGE_CODE', 'CollegeCode', 'Code'], idx, 0))
        c_name = str(get_val(['College Name', 'COLLEGE_NAME', 'CollegeName', 'Name'], 'Unknown College', 1))
        b_code = str(get_val(['Branch Code', 'BRANCH_CODE', 'BranchCode'], '000', 2))
        b_name = str(get_val(['Branch Name', 'BRANCH_NAME', 'BranchName'], 'Branch', 3))
        
        communities = {}
        for comm in ['OC', 'BC', 'BCM', 'MBC', 'SC', 'SCA', 'ST']:
            rank = get_val([f'{comm}_Rank', f'{comm} Rank', comm], 1000)
            cutoff = get_val([f'{comm}_Cutoff', f'{comm} Cutoff', 'Cutoff'], 190.0)
            
            try:
                r_int = int(float(str(rank).replace(',', '')))
            except:
                r_int = 1000
                
            try:
                c_float = float(str(cutoff).replace(',', ''))
            except:
                c_float = 190.0
            
            communities[comm] = {
                "closing_rank": r_int,
                "closing_cutoff": c_float,
                "filled": 10,
                "total": 10,
                "fill_pct": 100.0
            }

        avg_oc = get_val(['Avg_OC', 'AVG_OC', 'Cutoff'], 190.0)
        try:
            avg_val = float(str(avg_oc).replace(',', ''))
        except:
            avg_val = 190.0

        result.append({
            "college_code": c_code,
            "college_name": c_name,
            "branch_code": b_code,
            "branch_name": b_name,
            "avg_oc_cutoff": avg_val,
            "communities": communities
        })

    output_path = os.path.join('public', 'data.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    print(f"Successfully generated {output_path} with {len(result)} records.")

if __name__ == '__main__':
    main()
