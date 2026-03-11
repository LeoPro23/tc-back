# 1. Base image with Python and Node.js
# Usamos Debian con Node.js 20 y Python instalados
FROM node:20-bookworm-slim

# Set working directory
WORKDIR /app

# 2. Instalar dependencias del sistema requeridas para Python y ML
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python-is-python3 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 3. Configurar entorno virtual para Python para evitar warnings de sistema
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# 4. Copiar e instalar dependencias de Node.js (Back)
COPY package*.json ./
RUN npm install

# 5. Copiar e instalar dependencias de Python (ML)
COPY ml-service/requirements.txt ./ml-service/
RUN pip install --no-cache-dir -r ml-service/requirements.txt

# 6. Copiar el resto del código
COPY . .

# 7. Compilar NestJS asegurando limpiar la caché previa
RUN rm -rf dist && npm run build

# 8. Dar permisos de ejecución al script de arranque
RUN chmod +x start-services.sh

# 9. Exponer puertos (El de NestJS es normalmente 8000, internamente ML usa 8001)
EXPOSE 8000 8001

# 10. Iniciar ambos servicios
CMD ["./start-services.sh"]
