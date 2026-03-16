#!/bin/bash

# Iniciar el servicio ML en segundo plano
echo "Iniciando ML Service en el puerto 8001..."
cd /app/ml-service
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 &

# Volver a la raíz y arrancar la aplicación Node.js en primer plano
cd /app
echo "Contenido de dist:"
ls -R dist
echo "Iniciando servidor principal NestJS..."
npm run start:prod
