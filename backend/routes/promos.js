const express = require('express');
const PromoEmbed = require('../models/PromoEmbed');
const { ensureAuthenticated } = require('../middleware/auth');
const { asyncHandler, UnauthorizedError } = require('../middleware/errorHandler');

const router = express.Router();

const ADMIN_EMAIL = 'cartercedrick35@gmail.com';
const normalizeEmail = (value) => (value || '').trim().toLowerCase();

function ensureAdmin(req) {
  if (normalizeEmail(req.user?.email) !== ADMIN_EMAIL) {
    throw new UnauthorizedError('Admin access required');
  }
}

router.get('/', asyncHandler(async (_req, res) => {
  const promos = await PromoEmbed.find({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    promos,
  });
}));

router.post('/', ensureAuthenticated, asyncHandler(async (req, res) => {
  ensureAdmin(req);

  const {
    title,
    description = '',
    mediaType = 'link',
    embedUrl = '',
    ctaUrl = '',
    imageUrl = '',
    isActive = true,
  } = req.body || {};

  if (!title || typeof title !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Title is required',
    });
  }

  if (!ctaUrl && !embedUrl) {
    return res.status(400).json({
      success: false,
      error: 'Please provide at least one URL (embedUrl or ctaUrl)',
    });
  }

  const promo = await PromoEmbed.create({
    title: title.trim(),
    description,
    mediaType,
    embedUrl,
    ctaUrl,
    imageUrl,
    isActive,
    createdBy: req.user?.email || 'admin',
  });

  res.status(201).json({
    success: true,
    promo,
  });
}));

router.patch('/:id', ensureAuthenticated, asyncHandler(async (req, res) => {
  ensureAdmin(req);

  const update = {
    title: req.body?.title,
    description: req.body?.description,
    mediaType: req.body?.mediaType,
    embedUrl: req.body?.embedUrl,
    ctaUrl: req.body?.ctaUrl,
    imageUrl: req.body?.imageUrl,
    isActive: req.body?.isActive,
  };

  Object.keys(update).forEach((key) => {
    if (update[key] === undefined) {
      delete update[key];
    }
  });

  const promo = await PromoEmbed.findByIdAndUpdate(
    req.params.id,
    { $set: update },
    { new: true, runValidators: true }
  ).lean();

  if (!promo) {
    return res.status(404).json({
      success: false,
      error: 'Promo not found',
    });
  }

  res.json({
    success: true,
    promo,
  });
}));

router.delete('/:id', ensureAuthenticated, asyncHandler(async (req, res) => {
  ensureAdmin(req);

  const promo = await PromoEmbed.findByIdAndDelete(req.params.id).lean();

  if (!promo) {
    return res.status(404).json({
      success: false,
      error: 'Promo not found',
    });
  }

  res.json({
    success: true,
    deletedId: req.params.id,
  });
}));

module.exports = router;
