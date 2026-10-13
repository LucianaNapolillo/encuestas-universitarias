# Encuestas Universitarias — laboratorio vulnerable

Aplicación didáctica Node.js + Angular basada en la propuesta del TP del Grupo 4. Contiene deliberadamente la cadena de vulnerabilidades descrita: Stored XSS, cookie de sesión sin `HttpOnly`, JWT `alg:none`, path traversal y SQL injection con stacked queries.

**Solo para laboratorio local. No desplegar en redes públicas ni usar con datos reales.** El XSS de ejemplo puede enviar eventos únicamente al recolector local `/lab/collect`; no se exfiltran cookies a dominios externos. Los logs redactan el valor de la cookie.

## Ejecutar
Requiere Docker y Docker Compose:
```bash
docker compose up --build
```
Abrir http://localhost:8080. Detener con `docker compose down`.

## Usuarios demo
- Alumno: `fede` / `fede123`
- Administrador: `admin` / `admin123`
- Superadministrador: `superadmin` / `super123`

## Recorrido de la práctica
1. Entrá como `fede` y publicá un comentario HTML/script en una encuesta.
2. Ingresá como `admin` y abrí la encuesta. Los comentarios se renderizan como HTML sin escape; el script puede llamar al recolector local.
3. La cookie de sesión carece de `HttpOnly` y el token JWT usa `alg:none`, que se acepta sin firma.
4. En Administración, la exportación de logs resuelve la ruta a partir de `file` sin confinarla al directorio de logs (path traversal).
5. El endpoint interno de auditoría `GET /api/admin/votes?vote_id=...` concatena SQL y permite sentencias adicionales; requiere rol admin.

## Vulnerabilidades incluidas
- Stored XSS en comentarios.
- Cookie de sesión accesible desde JavaScript.
- JWT `alg:none` aceptado sin firma.
- Path traversal en lectura de logs.
- SQL injection con ejecución de sentencias múltiples.
- Endpoint interno de auditoría no expuesto en la navegación principal.

Esta app es intencionalmente insegura y no representa buenas prácticas de producción. Para remediar: escapar comentarios, usar cookies `HttpOnly`/`Secure`/`SameSite`, verificar JWT con algoritmo y firma permitidos, confinar rutas a un directorio autorizado, usar consultas parametrizadas y quitar endpoints de depuración.
