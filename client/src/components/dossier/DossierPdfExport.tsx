import { useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CreatorDossier, Platform } from '@/lib/dossier-types';
import { normalizeFormats, getPostingFrequencyLabel } from '@/lib/dossier-types';
import { formatCurrency, formatNumber, capitalize } from '@/lib/utils';

interface DossierPdfExportProps {
  dossier: CreatorDossier;
  onExportStart?: () => void;
  onExportComplete?: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

const platformLabels: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'Twitter / X',
  facebook: 'Facebook',
};

const tierLabels: Record<string, string> = {
  prime: 'Brand Prime',
  ready: 'Brand Ready',
  emerging: 'Emerging',
  'not-ready': 'Building',
};

const tierColors: Record<string, string> = {
  prime: '#16a34a',
  ready: '#B8956A',
  emerging: '#d97706',
  'not-ready': '#dc2626',
};

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'Very High';
  if (confidence >= 0.6) return 'High';
  if (confidence >= 0.4) return 'Moderate';
  if (confidence >= 0.2) return 'Low';
  return 'Very Low';
}

// ── Profile image to base64 ─────────────────────────────────────

async function imageToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Build the print-friendly HTML document ──────────────────────

function buildReportHtml(dossier: CreatorDossier, profileImageBase64: string | null): string {
  const { profile, platforms, content, aesthetic, niche, readinessScore, personality, revenueEstimate } = dossier;
  const formatsArray = normalizeFormats(content.formats);
  const frequencyLabel = getPostingFrequencyLabel(content.postingFrequency) || 'N/A';
  const generatedDate = new Date(dossier.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const tierColor = tierColors[readinessScore.tier] || '#d97706';
  const palette = aesthetic?.naturalPalette || aesthetic?.dominantColors.map((c) => c.hex) || [];

  // Compute total engagement rate across platforms
  const engagementRates = platforms
    .map((p) => p.metrics.engagementRate)
    .filter((r): r is number => r !== null);
  const avgEngagement =
    engagementRates.length > 0
      ? (engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length * 100).toFixed(1)
      : 'N/A';

  // Top 3 content themes
  const topThemes = content.themes.slice(0, 5);
  const maxThemeFreq = Math.max(...topThemes.map((t) => t.frequency), 0.01);

  // Product categories from niche keywords
  const productCategories = niche.primaryNiche.relatedKeywords.slice(0, 3);

  // Profile image HTML
  const profileImageHtml = profileImageBase64
    ? `<img src="${profileImageBase64}" alt="${profile.displayName || 'Creator'}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid ${tierColor};" />`
    : `<div style="width:96px;height:96px;border-radius:50%;background:#1a1a2e;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:700;color:#fff;border:3px solid ${tierColor};">${(profile.displayName || '?')[0].toUpperCase()}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Creator Intelligence Report - ${profile.displayName || 'Creator'}</title>
  <style>
    @page {
      size: letter;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a2e;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 8.5in;
      min-height: 11in;
      padding: 0.75in;
      page-break-after: always;
      position: relative;
      overflow: hidden;
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* ── Page 1: Cover ───────────────────────────── */

    .cover {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      background: linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 100%);
      color: #fff;
    }

    .cover-accent-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: ${palette.length >= 3 ? `linear-gradient(to right, ${palette.slice(0, 4).join(', ')})` : `linear-gradient(to right, #B8956A, #d4a574)`};
    }

    .cover-label {
      font-size: 11px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #B8956A;
      margin-bottom: 32px;
    }

    .cover-title {
      font-size: 32px;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 8px;
    }

    .cover-subtitle {
      font-size: 14px;
      color: #9ca3af;
      margin-bottom: 40px;
    }

    .cover-profile {
      margin-bottom: 24px;
    }

    .cover-name {
      font-size: 22px;
      font-weight: 700;
      margin-top: 16px;
    }

    .cover-handle {
      font-size: 13px;
      color: #9ca3af;
      margin-top: 4px;
    }

    .cover-score-container {
      margin-top: 32px;
      text-align: center;
    }

    .cover-score {
      font-size: 72px;
      font-weight: 800;
      color: ${tierColor};
      line-height: 1;
    }

    .cover-score-label {
      font-size: 12px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: ${tierColor};
      margin-top: 4px;
    }

    .cover-score-sublabel {
      font-size: 11px;
      color: #6b7280;
      margin-top: 8px;
    }

    .cover-date {
      position: absolute;
      bottom: 0.75in;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 10px;
      color: #6b7280;
    }

    .cover-branding {
      position: absolute;
      bottom: 0.5in;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 10px;
      color: #B8956A;
      letter-spacing: 1px;
    }

    /* ── Page headers ────────────────────────────── */

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
    }

    .page-header h2 {
      font-size: 20px;
      font-weight: 700;
    }

    .page-header .page-num {
      font-size: 11px;
      color: #9ca3af;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #6b7280;
      margin-bottom: 12px;
      margin-top: 24px;
    }

    .section-title:first-child {
      margin-top: 0;
    }

    /* ── Tables ───────────────────────────────────── */

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .data-table th {
      text-align: left;
      padding: 8px 12px;
      background: #f3f4f6;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
    }

    .data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #f3f4f6;
    }

    .data-table tr:last-child td {
      border-bottom: none;
    }

    /* ── Theme bars ───────────────────────────────── */

    .theme-bar-container {
      margin-bottom: 10px;
    }

    .theme-bar-label {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 4px;
    }

    .theme-bar-label span:first-child {
      font-weight: 600;
      text-transform: capitalize;
    }

    .theme-bar-label span:last-child {
      color: #9ca3af;
    }

    .theme-bar-track {
      height: 8px;
      background: #f3f4f6;
      border-radius: 4px;
      overflow: hidden;
    }

    .theme-bar-fill {
      height: 100%;
      border-radius: 4px;
      background: linear-gradient(to right, #B8956A, #d4a574);
    }

    /* ── Stat cards ───────────────────────────────── */

    .stat-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }

    .stat-card {
      flex: 1;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .stat-card .stat-value {
      font-size: 24px;
      font-weight: 800;
      color: #1a1a2e;
    }

    .stat-card .stat-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #9ca3af;
      margin-top: 4px;
    }

    /* ── Color palette ────────────────────────────── */

    .palette-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }

    .palette-swatch {
      flex: 1;
      height: 36px;
      border-radius: 6px;
      position: relative;
    }

    .palette-swatch-label {
      position: absolute;
      bottom: -18px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 9px;
      color: #9ca3af;
      font-family: monospace;
    }

    /* ── Info blocks ──────────────────────────────── */

    .info-block {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .info-block-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #9ca3af;
      margin-bottom: 4px;
    }

    .info-block-value {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a2e;
    }

    .info-block-desc {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
      line-height: 1.5;
    }

    /* ── Recommendation cards ─────────────────────── */

    .rec-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .rec-card-num {
      display: inline-block;
      width: 24px;
      height: 24px;
      line-height: 24px;
      text-align: center;
      background: #B8956A;
      color: #fff;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 700;
      margin-right: 8px;
    }

    .rec-card-title {
      display: inline;
      font-size: 14px;
      font-weight: 700;
    }

    /* ── Revenue highlight ────────────────────────── */

    .revenue-highlight {
      background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%);
      color: #fff;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }

    .revenue-highlight .revenue-label {
      font-size: 11px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #B8956A;
      margin-bottom: 8px;
    }

    .revenue-highlight .revenue-value {
      font-size: 36px;
      font-weight: 800;
      color: #B8956A;
    }

    .revenue-highlight .revenue-sublabel {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 4px;
    }

    /* ── CTA ──────────────────────────────────────── */

    .cta-box {
      background: linear-gradient(135deg, #B8956A 0%, #d4a574 100%);
      color: #fff;
      border-radius: 12px;
      padding: 24px 32px;
      text-align: center;
      margin-top: 24px;
    }

    .cta-box h3 {
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .cta-box p {
      font-size: 13px;
      opacity: 0.9;
      margin-bottom: 12px;
    }

    .cta-box .cta-url {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 1px;
    }

    /* ── Footer ───────────────────────────────────── */

    .page-footer {
      position: absolute;
      bottom: 0.5in;
      left: 0.75in;
      right: 0.75in;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
    }

    .two-col {
      display: flex;
      gap: 24px;
    }

    .two-col > div {
      flex: 1;
    }

    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tag {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      color: #4b5563;
    }

    @media print {
      body { background: #fff; }
      .page { margin: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- ═══════════════ PAGE 1: COVER ═══════════════ -->
  <div class="page cover">
    <div class="cover-accent-bar"></div>

    <div class="cover-label">Creator Intelligence Report</div>

    <div class="cover-profile">
      ${profileImageHtml}
    </div>

    <div class="cover-name">${profile.displayName || 'Creator'}</div>
    <div class="cover-handle">
      @${platforms[0]?.handle || 'unknown'} &middot; ${formatFollowers(profile.totalFollowers)} followers across ${platforms.length} platform${platforms.length !== 1 ? 's' : ''}
    </div>

    <div class="cover-score-container">
      <div class="cover-score">${readinessScore.totalScore}</div>
      <div class="cover-score-label">${tierLabels[readinessScore.tier] || 'Emerging'}</div>
      <div class="cover-score-sublabel">Brand Readiness Score</div>
    </div>

    <div class="cover-date">Generated ${generatedDate}</div>
    <div class="cover-branding">brandmenow.ai</div>
  </div>

  <!-- ═══════════════ PAGE 2: SOCIAL PRESENCE ═══════════════ -->
  <div class="page">
    <div class="page-header">
      <h2>Social Presence</h2>
      <span class="page-num">Page 2 of 4</span>
    </div>

    <div class="section-title">Platform Overview</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Platform</th>
          <th>Handle</th>
          <th>Followers</th>
          <th>Posts</th>
          <th>Engagement</th>
          <th>Avg Likes</th>
        </tr>
      </thead>
      <tbody>
        ${platforms
          .map(
            (p) => `
          <tr>
            <td style="font-weight:600;">${platformLabels[p.platform]}</td>
            <td>@${p.handle}</td>
            <td>${formatNumber(p.metrics.followers)}</td>
            <td>${p.metrics.postCount !== null ? formatNumber(p.metrics.postCount) : '-'}</td>
            <td>${p.metrics.engagementRate !== null ? `${(p.metrics.engagementRate * 100).toFixed(1)}%` : '-'}</td>
            <td>${p.metrics.avgLikes !== null ? formatNumber(p.metrics.avgLikes) : '-'}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>

    <div class="stat-row" style="margin-top:24px;">
      <div class="stat-card">
        <div class="stat-value">${formatFollowers(profile.totalFollowers)}</div>
        <div class="stat-label">Total Followers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${avgEngagement}${avgEngagement !== 'N/A' ? '%' : ''}</div>
        <div class="stat-label">Avg Engagement</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${platforms.length}</div>
        <div class="stat-label">Active Platforms</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${frequencyLabel}</div>
        <div class="stat-label">Post Frequency</div>
      </div>
    </div>

    <div class="section-title">Top Content Themes</div>
    ${topThemes
      .map(
        (theme) => `
      <div class="theme-bar-container">
        <div class="theme-bar-label">
          <span>${capitalize(theme.name)}</span>
          <span>${Math.round(theme.frequency * 100)}%</span>
        </div>
        <div class="theme-bar-track">
          <div class="theme-bar-fill" style="width:${Math.round((theme.frequency / maxThemeFreq) * 100)}%"></div>
        </div>
      </div>
    `,
      )
      .join('')}

    ${
      formatsArray.length > 0
        ? `
      <div class="section-title" style="margin-top:20px;">Content Formats</div>
      <div class="stat-row">
        ${formatsArray
          .slice(0, 4)
          .map(
            (fmt) => `
          <div class="stat-card">
            <div class="stat-value" style="font-size:18px;">${Math.round(fmt.percentage)}%</div>
            <div class="stat-label">${capitalize(fmt.format)}</div>
          </div>
        `,
          )
          .join('')}
      </div>
    `
        : ''
    }

    <div class="page-footer">
      <span>${profile.displayName || 'Creator'} - Intelligence Report</span>
      <span>brandmenow.ai</span>
    </div>
  </div>

  <!-- ═══════════════ PAGE 3: BRAND ANALYSIS ═══════════════ -->
  <div class="page">
    <div class="page-header">
      <h2>Brand Analysis</h2>
      <span class="page-num">Page 3 of 4</span>
    </div>

    <div class="two-col">
      <div>
        <div class="section-title">Primary Niche</div>
        <div class="info-block">
          <div class="info-block-value" style="text-transform:capitalize;">${niche.primaryNiche.name}</div>
          <div class="info-block-desc">
            Confidence: ${confidenceLabel(niche.primaryNiche.confidence)} (${Math.round(niche.primaryNiche.confidence * 100)}%)
            ${niche.primaryNiche.marketSize ? `&middot; ${capitalize(niche.primaryNiche.marketSize)} market` : ''}
          </div>
        </div>

        ${
          niche.secondaryNiches.length > 0
            ? `
          <div class="info-block-label" style="margin-top:12px;">Secondary Niches</div>
          <div class="tag-list" style="margin-top:4px;">
            ${niche.secondaryNiches.map((n) => `<span class="tag">${capitalize(n.name)}</span>`).join('')}
          </div>
        `
            : ''
        }

        <div class="section-title">Brand Personality</div>
        <div class="info-block">
          <div class="info-block-label">Archetype</div>
          <div class="info-block-value">${capitalize(personality.archetype)}</div>
        </div>
        <div class="info-block">
          <div class="info-block-label">Voice &amp; Tone</div>
          <div class="info-block-value">${personality.voiceTone}</div>
        </div>

        <div class="info-block-label" style="margin-top:12px;">Values</div>
        <div class="tag-list" style="margin-top:4px;">
          ${personality.values.map((v) => `<span class="tag">${capitalize(v)}</span>`).join('')}
        </div>

        <div class="info-block-label" style="margin-top:12px;">Traits</div>
        <div class="tag-list" style="margin-top:4px;">
          ${personality.traits.map((t) => `<span class="tag">${capitalize(t)}</span>`).join('')}
        </div>
      </div>

      <div>
        <div class="section-title">Color Palette</div>
        ${
          aesthetic && aesthetic.dominantColors.length > 0
            ? `
          <div class="palette-row">
            ${aesthetic.dominantColors
              .slice(0, 6)
              .map(
                (c) => `
              <div class="palette-swatch" style="background-color:${c.hex};">
                <span class="palette-swatch-label">${c.hex}</span>
              </div>
            `,
              )
              .join('')}
          </div>
          <div style="margin-top:24px;"></div>
        `
            : palette.length > 0
              ? `
          <div class="palette-row">
            ${palette
              .slice(0, 6)
              .map(
                (hex) => `
              <div class="palette-swatch" style="background-color:${hex};">
                <span class="palette-swatch-label">${hex}</span>
              </div>
            `,
              )
              .join('')}
          </div>
          <div style="margin-top:24px;"></div>
        `
              : '<p style="font-size:12px;color:#9ca3af;">No palette data available.</p>'
        }

        <div class="section-title">Aesthetic Profile</div>
        <div class="info-block">
          <div class="info-block-label">Overall Aesthetic</div>
          <div class="info-block-desc">${aesthetic?.overallAesthetic || 'Not available'}</div>
        </div>

        ${
          aesthetic && aesthetic.visualMood.length > 0
            ? `
          <div class="info-block-label" style="margin-top:12px;">Visual Mood</div>
          <div class="tag-list" style="margin-top:4px;">
            ${aesthetic.visualMood.map((m) => `<span class="tag">${capitalize(m)}</span>`).join('')}
          </div>
        `
            : ''
        }

        ${
          aesthetic && aesthetic.photographyStyle.length > 0
            ? `
          <div class="info-block-label" style="margin-top:12px;">Photography Style</div>
          <div class="tag-list" style="margin-top:4px;">
            ${aesthetic.photographyStyle.map((s) => `<span class="tag">${capitalize(s)}</span>`).join('')}
          </div>
        `
            : ''
        }

        <div class="section-title">Readiness Breakdown</div>
        ${readinessScore.factors
          .map(
            (f) => `
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
              <span style="font-weight:600;">${f.name}</span>
              <span style="color:#9ca3af;">${f.score}/100</span>
            </div>
            <div style="height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${f.score}%;border-radius:3px;background:${f.score >= 70 ? '#16a34a' : f.score >= 40 ? '#d97706' : '#dc2626'};"></div>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>

    <div class="page-footer">
      <span>${profile.displayName || 'Creator'} - Intelligence Report</span>
      <span>brandmenow.ai</span>
    </div>
  </div>

  <!-- ═══════════════ PAGE 4: RECOMMENDATIONS ═══════════════ -->
  <div class="page">
    <div class="page-header">
      <h2>Recommendations</h2>
      <span class="page-num">Page 4 of 4</span>
    </div>

    <div class="section-title">Recommended Product Categories</div>
    ${
      productCategories.length > 0
        ? productCategories
            .map(
              (cat, i) => `
        <div class="rec-card">
          <span class="rec-card-num">${i + 1}</span>
          <span class="rec-card-title">${capitalize(cat)}</span>
        </div>
      `,
            )
            .join('')
        : `
      <div class="rec-card">
        <span class="rec-card-num">1</span>
        <span class="rec-card-title">${capitalize(niche.primaryNiche.name)} Products</span>
      </div>
      ${
        niche.secondaryNiches[0]
          ? `
        <div class="rec-card">
          <span class="rec-card-num">2</span>
          <span class="rec-card-title">${capitalize(niche.secondaryNiches[0].name)} Products</span>
        </div>
      `
          : ''
      }
      <div class="rec-card">
        <span class="rec-card-num">${niche.secondaryNiches[0] ? '3' : '2'}</span>
        <span class="rec-card-title">Branded Merchandise</span>
      </div>
    `
    }

    <div class="revenue-highlight">
      <div class="revenue-label">Estimated Monthly Revenue Potential</div>
      <div class="revenue-value">${formatCurrency(revenueEstimate.estimatedMonthlyRevenue.mid)}</div>
      <div class="revenue-sublabel">
        Range: ${formatCurrency(revenueEstimate.estimatedMonthlyRevenue.low)} - ${formatCurrency(revenueEstimate.estimatedMonthlyRevenue.high)} / month
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-value" style="font-size:18px;">${formatCurrency(revenueEstimate.estimatedAnnualRevenue.mid)}</div>
        <div class="stat-label">Annual Potential</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="font-size:18px;">${(revenueEstimate.conversionRate * 100).toFixed(1)}%</div>
        <div class="stat-label">Est. Conversion Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="font-size:18px;">${formatCurrency(revenueEstimate.avgOrderValue)}</div>
        <div class="stat-label">Avg Order Value</div>
      </div>
    </div>

    ${
      readinessScore.actionItems.length > 0
        ? `
      <div class="section-title">Next Steps</div>
      ${readinessScore.actionItems
        .slice(0, 4)
        .map(
          (item, i) => `
        <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">
          <span style="flex-shrink:0;width:20px;height:20px;line-height:20px;text-align:center;background:#f3f4f6;border-radius:50%;font-size:10px;font-weight:700;color:#6b7280;">${i + 1}</span>
          <span style="font-size:13px;color:#4b5563;">${item}</span>
        </div>
      `,
        )
        .join('')}
    `
        : ''
    }

    <div class="cta-box">
      <h3>Ready to Build Your Brand?</h3>
      <p>Turn this intelligence into a complete, sellable brand identity in minutes.</p>
      <div class="cta-url">brandmenow.ai</div>
    </div>

    <div class="page-footer">
      <span>${profile.displayName || 'Creator'} - Intelligence Report</span>
      <span>brandmenow.ai</span>
    </div>
  </div>

</body>
</html>`;
}

// ── Main Component ──────────────────────────────────────────────

export default function DossierPdfExport({
  dossier,
  onExportStart,
  onExportComplete,
}: DossierPdfExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExport = useCallback(async () => {
    setIsGenerating(true);
    onExportStart?.();

    try {
      // Attempt to load profile image as base64 for embedding in the report
      let profileImageBase64: string | null = null;
      if (dossier.profile.profilePicUrl) {
        profileImageBase64 = await imageToBase64(dossier.profile.profilePicUrl);
      }

      const html = buildReportHtml(dossier, profileImageBase64);

      // Open a new window with the report and trigger print (Save as PDF)
      const printWindow = window.open('', '_blank', 'width=816,height=1056');
      if (!printWindow) {
        console.error('Failed to open print window. Pop-ups may be blocked.');
        return;
      }

      printWindow.document.write(html);
      printWindow.document.close();

      // Wait for content to render, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          onExportComplete?.();
        }, 500);
      };

      // Fallback if onload doesn't fire (some browsers)
      setTimeout(() => {
        try {
          if (!printWindow.closed) {
            printWindow.print();
          }
        } catch {
          // Window may have been closed by user
        }
        onExportComplete?.();
      }, 2000);
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [dossier, onExportStart, onExportComplete]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      loading={isGenerating}
      leftIcon={!isGenerating ? <FileText className="h-4 w-4" /> : undefined}
      className="flex-1"
    >
      {isGenerating ? 'Generating...' : 'Download Full Report'}
    </Button>
  );
}
