import pandas as pd
import json
import sys

def extract_excel_to_json(excel_file, output_file=None):
    """
    Extract all sheets from Excel file and convert to JSON
    """
    try:
        # Read all sheets from Excel file
        excel_data = pd.read_excel(excel_file, sheet_name=None, engine='openpyxl')
        
        # Convert to dictionary with all sheets
        result = {}
        
        for sheet_name, df in excel_data.items():
            print(f"Processing sheet: {sheet_name} ({len(df)} rows, {len(df.columns)} columns)")
            
            # Convert DataFrame to dict, handling NaN values
            sheet_data = df.fillna("").to_dict(orient='records')
            result[sheet_name] = sheet_data
        
        # Output file name
        if output_file is None:
            output_file = excel_file.rsplit('.', 1)[0] + '.json'
        
        # Write to JSON file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ Successfully extracted to: {output_file}")
        print(f"Total sheets: {len(result)}")
        
        return result
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    input_file = "00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx"
    output_file = "00. MV_Barge&Source 2021,2022, 2023,2024-7-19.json"
    
    print(f"Extracting: {input_file}")
    print("=" * 60)
    
    extract_excel_to_json(input_file, output_file)
