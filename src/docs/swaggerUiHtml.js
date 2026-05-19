export function renderSwaggerUiHtml({ title }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body { margin: 0; padding: 0; background: #ffffff; }
      .swagger-shell { min-height: 100vh; background: #ffffff; }
      .swagger-header {
        color: #111827;
        padding: 24px 24px 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .swagger-header h1 { margin: 0; font-size: 28px; }
      .swagger-header p { margin: 8px 0 0; color: #4b5563; max-width: 72ch; }
      #swagger-ui { margin-top: 16px; }
    </style>
  </head>
  <body>
    <div class="swagger-shell">
      <div class="swagger-header">
        <h1>${title}</h1>
        <p>Swagger UI for the Express backend. Authorization uses raw bearer tokens.</p>
      </div>
      <div id="swagger-ui"></div>
    </div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: './openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          displayRequestDuration: true,
          persistAuthorization: true,
          docExpansion: 'list',
          presets: [SwaggerUIBundle.presets.apis],
        });
      };
    </script>
  </body>
</html>`;
}
