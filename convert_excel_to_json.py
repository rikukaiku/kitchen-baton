import pandas as pd
import os

def convert_excel_to_json(excel_path, json_path):
    # Excelファイルを読み込む
    df = pd.read_excel(excel_path)
    # カラム名を自動検出し、必要な列だけ抽出
    col_map = {}
    for col in df.columns:
        if '名' in col: col_map['name'] = col
        if '住' in col: col_map['address'] = col
        if '緯' in col: col_map['lat'] = col
        if '経' in col: col_map['lng'] = col
    # 必要なカラムが揃っているかチェック
    if not all(k in col_map for k in ['name','address','lat','lng']):
        raise Exception(f"必要なカラムが見つかりません: {col_map}")
    # 欠損値を除外
    df2 = df[[col_map['name'], col_map['address'], col_map['lat'], col_map['lng']]].dropna(subset=[col_map['lat'], col_map['lng']])
    df2.columns = ['name', 'address', 'lat', 'lng']
    # JSONとして保存
    df2.to_json(json_path, orient='records', force_ascii=False)
    print(f'変換完了: {json_path}')

if __name__ == '__main__':
    excel_path = os.path.join('public', 'こども食堂一覧 (2).xlsx')
    json_path = os.path.join('public', 'saitama_kodomo_shokudo.json')
    convert_excel_to_json(excel_path, json_path)
