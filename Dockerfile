FROM nginx:1.27-alpine
# Railway sets $PORT; the nginx image fills it into the template at start-up.
COPY templates/default.conf.template /etc/nginx/templates/default.conf.template
COPY index.html /usr/share/nginx/html/index.html
