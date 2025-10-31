# File: face-attendance-system/ai/Dockerfile
# (เวอร์ชัน FastAPI - เพิ่ม libglib2.0-0)

# 1. Base Image
FROM python:3.10-slim

# 2. ติดตั้ง Dependencies ที่จำเป็น
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libjpeg-dev \
    # libgtk2.0-dev (ไม่จำเป็นสำหรับ headless) \
    libgl1 \
    libglib2.0-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 3. ตั้งค่าพื้นที่ทำงาน
WORKDIR /app

# 4. คัดลอกไฟล์ requirements และติดตั้งใน Virtual Environment
COPY requirements.txt .
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# 5. คัดลอกโค้ดทั้งหมด
COPY . .

# 6. เปลี่ยนคำสั่ง CMD ให้ใช้ Uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5001"]