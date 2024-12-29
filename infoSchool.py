## School 컬럼 추가 school_address

import pandas as pd
import pymysql

# 1. CSV 파일 읽기
file_path = 'school_info_2024_11_30.csv'
data = pd.read_csv(file_path, usecols=['학교명', '시도명', '도로명주소'])
data.fillna('', inplace=True)  # NaN 값 처리

# 2. MySQL 연결 설정
connection = pymysql.connect(
    host='0.0.0.0',  # MySQL 서버 주소
    user='checkjin_2023874',  # MySQL 사용자 이름
    password='checkjin_2023874',  # MySQL 비밀번호
    database='checkjin_2023874',  # 사용할 데이터베이스 이름
    charset='utf8mb4'
)

# 3. 데이터 삽입
try:
    with connection.cursor() as cursor:
        # INSERT 쿼리 준비
        insert_query = "INSERT INTO School (school_name, school_local, school_address) VALUES (%s, %s, %s)"
        # 데이터 삽입
        for _, row in data.iterrows():
            cursor.execute(insert_query, (row['학교명'], row['시도명'], row['도로명주소']))
    connection.commit()
    print("데이터 삽입 완료!")
finally:
    connection.close()
