// ============================================================
// Shared file upload helper — reads a File, base64-encodes it,
// and posts to /api/upload. Returns the public URL.
// ============================================================

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

async function uploadFile(file, bucket) {
  const MAX_SIZE = 25 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('File is too large (25MB max).');
  }
  const file_base64 = await fileToBase64(file);
  const result = await api('/upload', {
    method: 'POST',
    auth: true,
    body: {
      file_name: file.name,
      file_base64,
      content_type: file.type || 'application/octet-stream',
      bucket,
    },
  });
  return result.url;
}

// Wires up a drop-zone-style upload control.
// zoneEl: the clickable container element
// bucket: storage bucket name
// onUploaded(url): callback fired with the resulting public URL
// previewEl (optional): an <img> to show a preview after upload
function initUploadZone(zoneEl, bucket, onUploaded, previewEl) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,audio/*';
  input.style.display = 'none';
  zoneEl.appendChild(input);

  zoneEl.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    const originalText = zoneEl.querySelector('.upload-zone-label')?.textContent;
    zoneEl.classList.add('uploading');
    const label = zoneEl.querySelector('.upload-zone-label');
    if (label) label.textContent = 'Uploading...';

    try {
      const url = await uploadFile(file, bucket);
      onUploaded(url);
      if (previewEl && file.type.startsWith('image/')) {
        previewEl.src = url;
        previewEl.style.display = 'block';
      }
      showToast('File uploaded.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      zoneEl.classList.remove('uploading');
      if (label) label.textContent = originalText || 'Click to upload';
      input.value = '';
    }
  });
}
