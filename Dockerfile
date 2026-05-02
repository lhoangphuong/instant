# Static Snake game — nginx Alpine serves HTML/CSS/JS from repo root.
FROM nginx:alpine

COPY index.html styles.css game.js /usr/share/nginx/html/

EXPOSE 80
