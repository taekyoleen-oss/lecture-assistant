FROM nginx:alpine
COPY lecture-annotation-tool/ /usr/share/nginx/html/
EXPOSE 80
