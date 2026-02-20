// server/src/services/pdf-generator.js

/**
 * Dossier PDF Generation Service
 *
 * Generates a polished "Creator Intelligence Report" as a printable HTML
 * document that can be streamed as an HTML response with print-ready CSS,
 * or rendered to PDF via the browser's print dialog.
 *
 * Since pdfkit is not installed, this service generates a self-contained
 * HTML document with print-optimized CSS (@media print). The controller
 * serves it as `text/html` and the frontend can trigger `window.print()`.
 *
 * Sections:
 * - Header with report title and generation date
 * - Profile card (name, handle, bio, avatar)
 * - Niche analysis and brand readiness score
 * - Audience demographics
 * - Content themes and top hashtags
 * - Color palette visualization
 * - Competitive position (if available)
 * - Personality traits and brand archetype
 */

import { logger as rootLogger } from '../lib/logger.js';

const logger = rootLogger.child({ service: 'pdf-generator' });

/**
 * Escape HTML entities for safe embedding in the report.
 *
 * @param {string} text
 * @returns {string}
 */
function esc(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format a number with commas for readability.
 *
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  return num.toLocaleString('en-US');
}

/**
 * Render a brand readiness score as a visual bar.
 *
 * @param {number} score - Score from 0-100
 * @returns {string} HTML string
 */
function renderScoreBar(score) {
  const clampedScore = Math.max(0, Math.min(100, score || 0));
  const color = clampedScore >= 70 ? '#22c55e' : clampedScore >= 40 ? '#f59e0b' : '#ef4444';
  return `
    <div style="display:flex;align-items:center;gap:12px;margin:8px 0;">
      <div style="flex:1;background:#e5e7eb;border-radius:8px;height:16px;overflow:hidden;">
        <div style="width:${clampedScore}%;background:${color};height:100%;border-radius:8px;transition:width 0.3s;"></div>
      </div>
      <span style="font-weight:700;font-size:18px;color:${color};">${clampedScore}/100</span>
    </div>`;
}

/**
 * Render a color swatch from a hex value.
 *
 * @param {string} hex - Hex color value
 * @returns {string} HTML string
 */
function renderColorSwatch(hex) {
  return `
    <div style="display:inline-flex;flex-direction:column;align-items:center;margin:4px 8px;">
      <div style="width:48px;height:48px;border-radius:8px;background:${esc(hex)};border:1px solid #d1d5db;"></div>
      <span style="font-size:11px;color:#6b7280;margin-top:4px;">${esc(hex)}</span>
    </div>`;
}

/**
 * Render a stat card with label and value.
 *
 * @param {string} label
 * @param {string|number} value
 * @returns {string} HTML string
 */
function renderStat(label, value) {
  return `
    <div style="text-align:center;padding:12px 16px;">
      <div style="font-size:24px;font-weight:700;color:#111827;">${esc(String(value))}</div>
      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">${esc(label)}</div>
    </div>`;
}

/**
 * Generate a self-contained HTML document for the Creator Intelligence Report.
 *
 * @param {Object} dossierData - Full dossier data from wizard_state['social-analysis']
 * @returns {Buffer} UTF-8 encoded HTML buffer
 */
export function generateDossierPdf(dossierData) {
  logger.info('Generating dossier PDF report');

  const d = dossierData || {};
  const profile = d.profile || d.profiles?.[0] || {};
  const niche = d.niche || {};
  const personality = d.personality || {};
  const audience = d.audience || d.demographics || {};
  const content = d.content || d.contentThemes || {};
  const colors = d.colors || d.brandColors || [];
  const readiness = d.brandReadiness || d.readinessScore || {};
  const competitors = d.competitors || [];
  const generatedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Creator Intelligence Report - ${esc(profile.displayName || profile.handle || 'Unknown')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }

    .header {
      text-align: center;
      padding-bottom: 24px;
      border-bottom: 3px solid #111827;
      margin-bottom: 32px;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111827;
    }

    .header .subtitle {
      font-size: 14px;
      color: #6b7280;
      margin-top: 4px;
    }

    .section {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }

    .profile-card {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }

    .profile-avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: #d1d5db;
      flex-shrink: 0;
      overflow: hidden;
    }

    .profile-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .profile-info h2 {
      font-size: 20px;
      font-weight: 700;
    }

    .profile-info .handle {
      color: #6b7280;
      font-size: 14px;
    }

    .profile-info .bio {
      font-size: 13px;
      color: #374151;
      margin-top: 6px;
    }

    .stats-grid {
      display: flex;
      justify-content: space-around;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      padding: 8px;
      margin-top: 12px;
    }

    .tag {
      display: inline-block;
      padding: 3px 10px;
      background: #e0e7ff;
      color: #3730a3;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      margin: 2px 4px;
    }

    .tag.green {
      background: #d1fae5;
      color: #065f46;
    }

    .trait-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .competitor-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }

    .competitor-row:last-child {
      border-bottom: none;
    }

    .footer {
      text-align: center;
      padding-top: 24px;
      border-top: 2px solid #e5e7eb;
      margin-top: 32px;
      color: #9ca3af;
      font-size: 12px;
    }

    @media print {
      body { background: white; }
      .page { padding: 20px; max-width: none; }
      .section { page-break-inside: avoid; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <h1>Creator Intelligence Report</h1>
      <div class="subtitle">Generated by Brand Me Now &middot; ${esc(generatedAt)}</div>
    </div>

    <!-- Profile Card -->
    <div class="section">
      <div class="section-title">Profile Overview</div>
      <div class="profile-card">
        <div class="profile-avatar">
          ${profile.profilePicUrl ? `<img src="${esc(profile.profilePicUrl)}" alt="Profile" />` : ''}
        </div>
        <div class="profile-info">
          <h2>${esc(profile.displayName || profile.handle || 'Creator')}</h2>
          <div class="handle">${profile.handle ? `@${esc(profile.handle)}` : ''}${profile.platform ? ` &middot; ${esc(profile.platform)}` : ''}</div>
          ${profile.bio ? `<div class="bio">${esc(profile.bio)}</div>` : ''}
        </div>
      </div>
      <div class="stats-grid">
        ${renderStat('Followers', formatNumber(profile.followerCount || 0))}
        ${renderStat('Following', formatNumber(profile.followingCount || 0))}
        ${renderStat('Posts', formatNumber(profile.postCount || 0))}
        ${profile.isVerified ? renderStat('Verified', 'Yes') : ''}
      </div>
    </div>

    <!-- Brand Readiness Score -->
    ${readiness.score != null || readiness.overall != null ? `
    <div class="section">
      <div class="section-title">Brand Readiness Score</div>
      ${renderScoreBar(readiness.score || readiness.overall || 0)}
      ${readiness.summary ? `<p style="font-size:14px;color:#374151;margin-top:8px;">${esc(readiness.summary)}</p>` : ''}
      ${readiness.strengths?.length ? `
        <div style="margin-top:12px;">
          <strong style="font-size:13px;color:#065f46;">Strengths:</strong>
          <div class="trait-list">
            ${readiness.strengths.map((/** @type {string} */ s) => `<span class="tag green">${esc(s)}</span>`).join('')}
          </div>
        </div>` : ''}
      ${readiness.improvements?.length ? `
        <div style="margin-top:8px;">
          <strong style="font-size:13px;color:#92400e;">Areas for Growth:</strong>
          <div class="trait-list">
            ${readiness.improvements.map((/** @type {string} */ s) => `<span class="tag">${esc(s)}</span>`).join('')}
          </div>
        </div>` : ''}
    </div>` : ''}

    <!-- Niche Analysis -->
    ${niche.primaryNiche || niche.name ? `
    <div class="section">
      <div class="section-title">Niche Analysis</div>
      <p style="font-size:14px;"><strong>Primary Niche:</strong> ${esc(niche.primaryNiche?.name || niche.name || 'Not determined')}</p>
      ${niche.primaryNiche?.confidence ? `<p style="font-size:13px;color:#6b7280;">Confidence: ${Math.round(niche.primaryNiche.confidence * 100)}%</p>` : ''}
      ${niche.subNiches?.length ? `
        <div style="margin-top:8px;">
          <strong style="font-size:13px;">Sub-niches:</strong>
          <div class="trait-list">
            ${niche.subNiches.map((/** @type {any} */ n) => `<span class="tag">${esc(typeof n === 'string' ? n : n.name)}</span>`).join('')}
          </div>
        </div>` : ''}
      ${niche.analysis ? `<p style="font-size:13px;color:#374151;margin-top:8px;">${esc(niche.analysis)}</p>` : ''}
    </div>` : ''}

    <!-- Audience Demographics -->
    ${audience.ageRange || audience.gender || audience.topLocations?.length ? `
    <div class="section">
      <div class="section-title">Audience Demographics</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        ${audience.ageRange ? `<div><strong>Age Range:</strong> ${esc(audience.ageRange)}</div>` : ''}
        ${audience.gender ? `<div><strong>Gender Split:</strong> ${esc(audience.gender)}</div>` : ''}
        ${audience.primaryLanguage ? `<div><strong>Language:</strong> ${esc(audience.primaryLanguage)}</div>` : ''}
      </div>
      ${audience.topLocations?.length ? `
        <div style="margin-top:8px;">
          <strong>Top Locations:</strong>
          <div class="trait-list">
            ${audience.topLocations.map((/** @type {string} */ loc) => `<span class="tag">${esc(loc)}</span>`).join('')}
          </div>
        </div>` : ''}
      ${audience.interests?.length ? `
        <div style="margin-top:8px;">
          <strong>Interests:</strong>
          <div class="trait-list">
            ${audience.interests.map((/** @type {string} */ i) => `<span class="tag green">${esc(i)}</span>`).join('')}
          </div>
        </div>` : ''}
    </div>` : ''}

    <!-- Content Themes -->
    ${content.themes?.length || content.topHashtags?.length ? `
    <div class="section">
      <div class="section-title">Content Themes</div>
      ${content.themes?.length ? `
        <div>
          <strong>Primary Themes:</strong>
          <div class="trait-list">
            ${content.themes.map((/** @type {any} */ t) => `<span class="tag">${esc(typeof t === 'string' ? t : t.name)}</span>`).join('')}
          </div>
        </div>` : ''}
      ${content.topHashtags?.length ? `
        <div style="margin-top:8px;">
          <strong>Top Hashtags:</strong>
          <div class="trait-list">
            ${content.topHashtags.slice(0, 15).map((/** @type {string} */ h) => `<span class="tag green">${esc(h)}</span>`).join('')}
          </div>
        </div>` : ''}
      ${content.postingFrequency ? `<p style="font-size:13px;color:#6b7280;margin-top:8px;">Posting Frequency: ${esc(content.postingFrequency)}</p>` : ''}
    </div>` : ''}

    <!-- Color Palette -->
    ${colors.length > 0 ? `
    <div class="section">
      <div class="section-title">Detected Color Palette</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${colors.map((/** @type {string} */ c) => renderColorSwatch(c)).join('')}
      </div>
    </div>` : ''}

    <!-- Personality & Archetype -->
    ${personality.traits?.length || personality.archetype ? `
    <div class="section">
      <div class="section-title">Brand Personality</div>
      ${personality.archetype ? `<p style="font-size:14px;"><strong>Archetype:</strong> ${esc(typeof personality.archetype === 'string' ? personality.archetype : personality.archetype.name)}</p>` : ''}
      ${personality.traits?.length ? `
        <div style="margin-top:8px;">
          <strong>Key Traits:</strong>
          <div class="trait-list">
            ${personality.traits.map((/** @type {string} */ t) => `<span class="tag">${esc(t)}</span>`).join('')}
          </div>
        </div>` : ''}
      ${personality.tone ? `<p style="font-size:13px;color:#374151;margin-top:8px;"><strong>Tone of Voice:</strong> ${esc(personality.tone)}</p>` : ''}
    </div>` : ''}

    <!-- Competitive Position -->
    ${competitors.length > 0 ? `
    <div class="section">
      <div class="section-title">Competitive Landscape</div>
      ${competitors.map((/** @type {any} */ c) => `
        <div class="competitor-row">
          <div>
            <strong>${esc(c.name)}</strong>
            <span style="color:#6b7280;font-size:13px;"> @${esc(c.handle)}</span>
          </div>
          <div style="text-align:right;">
            <span style="font-weight:600;">${formatNumber(c.followers || 0)}</span>
            <span style="color:#6b7280;font-size:12px;"> followers</span>
          </div>
        </div>`).join('')}
      ${d.marketAnalysis ? `<p style="font-size:13px;color:#374151;margin-top:12px;">${esc(d.marketAnalysis)}</p>` : ''}
    </div>` : ''}

    <!-- Footer -->
    <div class="footer">
      <p>Creator Intelligence Report &middot; Brand Me Now v2</p>
      <p>This report was generated using AI-powered analysis. Data is based on publicly available information.</p>
      <p style="margin-top:8px;">
        <button class="no-print" onclick="window.print()" style="padding:8px 24px;background:#111827;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">
          Print / Save as PDF
        </button>
      </p>
    </div>
  </div>
</body>
</html>`;

  logger.info({ profileHandle: profile.handle }, 'Dossier report generated');
  return Buffer.from(html, 'utf-8');
}

export default {
  generateDossierPdf,
};
