import pandas as pd
import pymysql

# 1. CSV 파일 읽기
file_path = '전국대학및전문대학정보표준데이터.csv'
data = pd.read_csv(file_path, usecols=['학교명'])
data.fillna('', inplace=True)  # NaN 값 처리

# 2. 대학명 중복 제거
data['학교명'] = data['학교명'].str.split().str[0]  # 첫 번째 단어 기준으로 추출
data = data.drop_duplicates(subset=['학교명'])  # 중복 제거

# 3. MySQL 연결 설정
connection = pymysql.connect(
    host='0.0.0.0',  # MySQL 서버 주소
    user='checkjin_2023874',  # MySQL 사용자 이름
    password='checkjin_2023874',  # MySQL 비밀번호
    database='checkjin_2023874',  # 사용할 데이터베이스 이름
    charset='utf8mb4'
)

# 4. 데이터 삽입
try:
    with connection.cursor() as cursor:
        # INSERT 쿼리 준비
        insert_query = "INSERT INTO School (school_name) VALUES (%s)"
        # 데이터 삽입
        for _, row in data.iterrows():
            cursor.execute(insert_query, (row['학교명'],))
    connection.commit()
    print("데이터 삽입 완료!")
finally:
    connection.close()
