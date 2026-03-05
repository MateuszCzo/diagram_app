docker run -dtP --name postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=diagram_app postgres-image

npm run build
npm run start

npm run dev