const mongoose = require('mongoose');

const promoEmbedSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 600,
    default: '',
  },
  mediaType: {
    type: String,
    enum: ['link', 'youtube', 'vimeo', 'iframe', 'pdf', 'ebook'],
    default: 'link',
    index: true,
  },
  embedUrl: {
    type: String,
    trim: true,
    default: '',
  },
  ctaUrl: {
    type: String,
    trim: true,
    default: '',
  },
  imageUrl: {
    type: String,
    trim: true,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdBy: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
  collection: 'promo_embeds',
});

promoEmbedSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('PromoEmbed', promoEmbedSchema);
