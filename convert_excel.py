import pandas as pd
import sys
import os

# Excelファイルのパス（引数から取得）
excel_file = sys.argv[1] if len(sys.argv) > 1 else 'こども食堂一覧 (2).xlsx'
output_csv = 'public/saitama.csv'

try:
    # Excelファイルを読み込む
    df = pd.read_excel(excel_file)
    print(f"Excelファイル読み込み成功: {len(df)}行")
    print("カラム:", list(df.columns))

    # CSVとして保存
    df.to_csv(output_csv, index=False, encoding='utf-8')
    print(f"CSVファイル保存完了: {output_csv}")

except Exception as e:
    print(f"エラー: {e}")
    sys.exit(1)