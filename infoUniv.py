## School 컬럼 추가 school_address

import pandas as pd
import pymysql

# 1. CSV 파일 읽기
file_path = '전국대학및전문대학정보표준데이터.csv'
data = pd.read_csv(file_path, usecols=['학교명', '시도명', '소재지도로명주소'])
data.fillna('', inplace=True)  # NaN 값 처리

# 2. MySQL 연결 설정
connection = pymysql.connect(
    host='localhost',  # MySQL 서버 주소
    user='root',  # MySQL 사용자 이름
    password='yigija27~~',  # MySQL 비밀번호
    database='checkjin_2023874',  # 사용할 데이터베이스 이름
    charset='utf8mb4'
)

# 3. 데이터 삽입
try:
    with connection.cur
