// ============================================================
// AVATAR — upload handler only
// The illustrated library has been removed.
// The persona card shows a placeholder until the user uploads a photo.
// ============================================================

// ── GET CURRENT AVATAR SRC ───────────────────────────────────
// Returns the uploaded data URL, or null if nothing has been uploaded.
function getCurrentAvatarSrc() {
  if (formData.avatarType === 'upload' && formData.avatarDataUrl) {
    return formData.avatarDataUrl;
  }
  return null;
}

// ── UPLOAD HANDLER ───────────────────────────────────────────
function handleAvatarUpload(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file (PNG, JPG, SVG).', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image is too large (max 2MB). Please resize before uploading.', 'warning');
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    formData.avatarType    = 'upload';
    formData.avatarDataUrl = e.target.result;
    triggerSave();
    // Update upload preview thumbnail inside the drop zone
    const uploadPreview = document.getElementById('avatar-upload-preview');
    if (uploadPreview) {
      uploadPreview.src = e.target.result;
      uploadPreview.style.display = 'block';
    }
    const uploadHint = document.getElementById('avatar-upload-hint');
    if (uploadHint) uploadHint.style.display = 'none';
    const removeBtn = document.getElementById('avatar-remove-btn');
    if (removeBtn) removeBtn.style.display = '';
    renderPreview();
    showToast('Photo uploaded.', 'success');
  };
  reader.readAsDataURL(file);
}

// ── REMOVE UPLOADED PHOTO ────────────────────────────────────
function removeAvatarUpload(e) {
  e.preventDefault();
  e.stopPropagation();
  formData.avatarType    = '';
  formData.avatarDataUrl = '';
  triggerSave();
  const uploadPreview = document.getElementById('avatar-upload-preview');
  if (uploadPreview) {
    uploadPreview.src = '';
    uploadPreview.style.display = 'none';
  }
  const uploadHint = document.getElementById('avatar-upload-hint');
  if (uploadHint) uploadHint.style.display = '';
  renderPreview();
  showToast('Photo removed.', 'success');
}
