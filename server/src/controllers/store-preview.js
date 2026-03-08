// server/src/controllers/store-preview.js
// Server-rendered storefront preview page.
// Returns a self-contained HTML page that fetches store data from the API
// and renders it inline with vanilla JS. Designed for dashboard iframe previews
// so the storefront can be previewed without needing subdomain DNS.

import { supabaseAdmin } from '../lib/supabase.js';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

/**
 * GET /api/v1/store/:slug/preview
 * Serves an HTML shell that loads and renders the storefront via the public API.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function serveStorePreview(req, res, next) {
  try {
    const { slug } = req.params;

    // Verify storefront exists (any status -- preview works for drafts too)
    const { data: storefront, error } = await supabaseAdmin
      .from('storefronts')
      .select('id, slug, status')
      .eq('slug', slug)
      .single();

    if (error || !storefront) {
      return res.status(404).send('Storefront not found');
    }

    const apiUrl = config.API_URL || `${req.protocol}://${req.get('host')}`;

    res.setHeader('Content-Type', 'text/html');
    res.send(buildPreviewHtml(slug, apiUrl));
  } catch (err) {
    logger.error({ err, slug: req.params.slug }, 'Store preview render failed');
    return next(err);
  }
}

/**
 * Build the self-contained preview HTML page.
 * @param {string} slug
 * @param {string} apiUrl
 * @returns {string}
 */
function buildPreviewHtml(slug, apiUrl) {
  // Escape slug for safe interpolation into HTML/JS
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeSlug} - Preview</title>
  <script>
    window.__STORE_SLUG__ = "${safeSlug}";
    window.__API_URL__ = "${apiUrl}";
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
    .preview-loading {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; font-size: 1.125rem; opacity: 0.5;
    }
    .preview-error {
      text-align: center; padding: 4rem 2rem;
      font-size: 1.125rem; opacity: 0.6;
    }
  </style>
</head>
<body>
  <div id="root"><div class="preview-loading">Loading preview...</div></div>
  <script>
    (function() {
      var slug = window.__STORE_SLUG__;
      var apiUrl = window.__API_URL__;

      fetch(apiUrl + '/api/v1/store/' + slug)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.success) {
            document.getElementById('root').innerHTML = '<div class="preview-error">Store not found</div>';
            return;
          }
          renderStorefront(data.data);
        })
        .catch(function() {
          document.getElementById('root').innerHTML = '<div class="preview-error">Failed to load preview</div>';
        });

      function renderStorefront(store) {
        var brand = store.brand || {};
        var theme = store.theme || {};
        var sections = store.sections || [];
        var testimonials = store.testimonials || [];
        var faqs = store.faqs || [];

        var colors = (theme.baseStyles && theme.baseStyles.colors) || {};
        var primary = colors.primary || '#000';
        var accent = colors.accent || '#666';
        var bg = colors.background || '#fff';
        var text = colors.text || '#111';

        document.body.style.background = bg;
        document.body.style.color = text;

        var html = '';
        var sorted = sections.slice().sort(function(a, b) { return a.sortOrder - b.sortOrder; });

        for (var i = 0; i < sorted.length; i++) {
          html += renderSection(sorted[i], { brand: brand, primary: primary, accent: accent, bg: bg, text: text, testimonials: testimonials, faqs: faqs });
        }

        document.getElementById('root').innerHTML = html;
      }

      function esc(s) {
        if (!s) return '';
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
      }

      function renderSection(section, ctx) {
        var c = section.content || {};
        switch (section.sectionType) {
          case 'hero':
            return '<section style="background:' + ctx.primary + ';color:#fff;padding:6rem 2rem;text-align:center">'
              + '<h1 style="font-size:3rem;font-weight:800;margin-bottom:1rem">' + esc(c.headline) + '</h1>'
              + '<p style="font-size:1.25rem;opacity:0.9;margin-bottom:2rem">' + esc(c.subheadline) + '</p>'
              + '<a href="' + esc(c.ctaUrl || '#') + '" style="display:inline-block;background:#fff;color:' + ctx.primary + ';padding:0.875rem 2.5rem;border-radius:0.5rem;font-weight:700;text-decoration:none">' + esc(c.ctaText || 'Shop Now') + '</a>'
              + '</section>';

          case 'trust-bar':
            var trustItems = (c.items || []).map(function(item) {
              return '<span style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;font-weight:600;opacity:0.7">' + esc(item.text) + '</span>';
            }).join('');
            return '<section style="background:' + ctx.bg + ';border-bottom:1px solid #eee;padding:1.5rem 2rem;display:flex;justify-content:center;gap:3rem;flex-wrap:wrap">' + trustItems + '</section>';

          case 'welcome':
            return '<section style="max-width:48rem;margin:0 auto;padding:5rem 2rem;text-align:center">'
              + '<h2 style="font-size:2rem;font-weight:700;margin-bottom:1.5rem">' + esc(c.title) + '</h2>'
              + '<div style="font-size:1.125rem;line-height:1.75;opacity:0.8">' + esc(c.body).replace(/\\n/g, '<br>') + '</div>'
              + '</section>';

          case 'steps':
            var stepsHtml = (c.steps || []).map(function(s, idx) {
              return '<div style="flex:1;min-width:200px;max-width:300px;padding:2rem">'
                + '<div style="width:3rem;height:3rem;border-radius:50%;background:' + ctx.primary + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.25rem;margin:0 auto 1rem">' + (idx + 1) + '</div>'
                + '<h3 style="font-weight:700;margin-bottom:0.5rem">' + esc(s.title) + '</h3>'
                + '<p style="font-size:0.875rem;opacity:0.7">' + esc(s.description) + '</p>'
                + '</div>';
            }).join('');
            return '<section style="background:#f8f9fa;padding:5rem 2rem;text-align:center">'
              + '<h2 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">' + esc(c.title) + '</h2>'
              + '<p style="opacity:0.7;margin-bottom:3rem">' + esc(c.subtitle) + '</p>'
              + '<div style="display:flex;justify-content:center;gap:2rem;flex-wrap:wrap;max-width:64rem;margin:0 auto">' + stepsHtml + '</div>'
              + '</section>';

          case 'why-bundles':
            var reasonsHtml = (c.reasons || []).map(function(r) {
              return '<div style="flex:1;min-width:200px;max-width:300px;padding:2rem;background:#f8f9fa;border-radius:1rem">'
                + '<h3 style="font-weight:700;margin-bottom:0.5rem">' + esc(r.title) + '</h3>'
                + '<p style="font-size:0.875rem;opacity:0.7">' + esc(r.description) + '</p>'
                + '</div>';
            }).join('');
            return '<section style="padding:5rem 2rem;text-align:center">'
              + '<h2 style="font-size:2rem;font-weight:700;margin-bottom:3rem">' + esc(c.title) + '</h2>'
              + '<div style="display:flex;justify-content:center;gap:2rem;flex-wrap:wrap;max-width:64rem;margin:0 auto">' + reasonsHtml + '</div>'
              + '</section>';

          case 'testimonials':
            var testimonialsHtml = (ctx.testimonials || []).map(function(t) {
              var stars = '';
              for (var s = 0; s < (t.rating || 5); s++) stars += '&#9733;';
              return '<div style="flex:1;min-width:250px;max-width:350px;background:#fff;padding:2rem;border-radius:1rem;text-align:left;box-shadow:0 1px 3px rgba(0,0,0,0.1)">'
                + '<div style="color:' + ctx.primary + ';margin-bottom:0.75rem">' + stars + '</div>'
                + '<p style="font-size:0.9375rem;line-height:1.6;margin-bottom:1rem;opacity:0.85">"' + esc(t.quote || t.body) + '"</p>'
                + '<p style="font-weight:700;font-size:0.875rem">' + esc(t.authorName || t.author_name) + '</p>'
                + '<p style="font-size:0.75rem;opacity:0.5">' + esc(t.authorTitle || t.author_title || '') + '</p>'
                + '</div>';
            }).join('');
            return '<section style="background:#f8f9fa;padding:5rem 2rem;text-align:center">'
              + '<h2 style="font-size:2rem;font-weight:700;margin-bottom:3rem">' + esc(c.title || 'What People Are Saying') + '</h2>'
              + '<div style="display:flex;justify-content:center;gap:2rem;flex-wrap:wrap;max-width:72rem;margin:0 auto">' + testimonialsHtml + '</div>'
              + '</section>';

          case 'faq':
            var faqsHtml = (ctx.faqs || []).map(function(f) {
              return '<details style="border-bottom:1px solid #eee;padding:1.25rem 0">'
                + '<summary style="font-weight:600;cursor:pointer;font-size:1.0625rem">' + esc(f.question) + '</summary>'
                + '<p style="margin-top:0.75rem;opacity:0.75;line-height:1.6">' + esc(f.answer) + '</p>'
                + '</details>';
            }).join('');
            return '<section style="max-width:48rem;margin:0 auto;padding:5rem 2rem">'
              + '<h2 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem;text-align:center">' + esc(c.title || 'FAQ') + '</h2>'
              + '<p style="text-align:center;opacity:0.7;margin-bottom:3rem">' + esc(c.subtitle || '') + '</p>'
              + faqsHtml
              + '</section>';

          case 'about':
            return '<section style="padding:5rem 2rem;text-align:center;max-width:48rem;margin:0 auto">'
              + '<h2 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">' + esc(c.title) + '</h2>'
              + '<p style="opacity:0.7;margin-bottom:2rem">' + esc(c.subtitle) + '</p>'
              + '<div style="font-size:1.0625rem;line-height:1.75;opacity:0.8">' + esc(c.body).replace(/\\n/g, '<br>') + '</div>'
              + '</section>';

          case 'contact':
            return '<section style="background:' + ctx.primary + ';color:#fff;padding:5rem 2rem;text-align:center">'
              + '<h2 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">' + esc(c.title || 'Get in Touch') + '</h2>'
              + '<p style="opacity:0.9;margin-bottom:2rem">' + esc(c.subtitle || '') + '</p>'
              + '<a href="mailto:hello@example.com" style="display:inline-block;background:#fff;color:' + ctx.primary + ';padding:0.875rem 2.5rem;border-radius:0.5rem;font-weight:700;text-decoration:none">Contact Us</a>'
              + '</section>';

          case 'quality':
            var badgesHtml = (c.badges || []).map(function(b) {
              return '<span style="background:#f0fdf4;color:#166534;padding:0.5rem 1rem;border-radius:2rem;font-size:0.875rem;font-weight:600">' + esc(b) + '</span>';
            }).join('');
            return '<section style="padding:5rem 2rem;text-align:center;max-width:48rem;margin:0 auto">'
              + '<h2 style="font-size:2rem;font-weight:700;margin-bottom:1.5rem">' + esc(c.title) + '</h2>'
              + '<p style="line-height:1.75;opacity:0.8;margin-bottom:2rem">' + esc(c.body) + '</p>'
              + '<div style="display:flex;justify-content:center;gap:1.5rem;flex-wrap:wrap">' + badgesHtml + '</div>'
              + '</section>';

          case 'products':
          case 'bundle-grid':
            return '<section style="padding:5rem 2rem;text-align:center">'
              + '<h2 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">' + esc(c.title || 'Our Products') + '</h2>'
              + '<p style="opacity:0.7;margin-bottom:2rem">' + esc(c.subtitle || '') + '</p>'
              + '<p style="opacity:0.5;font-style:italic">Products will be displayed here</p>'
              + '</section>';

          default:
            return '';
        }
      }
    })();
  </script>
</body>
</html>`;
}
