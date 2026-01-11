export const transferPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>File Transfer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    h1 {
      color: #e94560;
      font-size: 28px;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .subtitle { color: rgba(255,255,255,0.6); margin-bottom: 32px; font-size: 14px; }
    .drop-zone {
      border: 2px dashed rgba(233,69,96,0.5);
      border-radius: 16px;
      padding: 60px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background: rgba(233,69,96,0.05);
      margin-bottom: 24px;
    }
    .drop-zone:hover, .drop-zone.drag-over {
      border-color: #e94560;
      background: rgba(233,69,96,0.15);
      transform: scale(1.02);
    }
    .drop-zone svg { width: 48px; height: 48px; color: #e94560; margin-bottom: 16px; }
    .drop-zone p { color: rgba(255,255,255,0.8); font-size: 16px; }
    .drop-zone span { color: rgba(255,255,255,0.5); font-size: 13px; display: block; margin-top: 8px; }
    input[type="file"] { display: none; }
    .file-list { margin-bottom: 24px; max-height: 200px; overflow-y: auto; }
    .file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255,255,255,0.05);
      padding: 12px 16px;
      border-radius: 10px;
      margin-bottom: 8px;
      color: white;
      font-size: 14px;
    }
    .file-item .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-item .size { color: rgba(255,255,255,0.5); margin-left: 12px; }
    .file-item .remove { color: #e94560; cursor: pointer; margin-left: 12px; font-size: 18px; }
    button {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #e94560 0%, #c23152 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    button:hover { transform: translateY(-2px); box-shadow: 0 10px 30px -10px rgba(233,69,96,0.5); }
    button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .progress {
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      margin-top: 16px;
      overflow: hidden;
      display: none;
    }
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #e94560, #ff6b6b);
      width: 0%;
      transition: width 0.3s ease;
    }
    .status { color: rgba(255,255,255,0.7); text-align: center; margin-top: 16px; font-size: 14px; }
    .success { color: #4ade80; }
    .error { color: #f87171; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📁 File Transfer</h1>
    <p class="subtitle">Upload files directly to this machine</p>
    <div class="drop-zone" id="dropZone">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p>Drop files here or tap to browse</p>
      <span>Supports any file type</span>
    </div>
    <input type="file" id="fileInput" multiple accept="*/*">
    <div class="file-list" id="fileList"></div>
    <button id="uploadBtn" disabled>Upload Files</button>
    <div class="progress" id="progress"><div class="progress-bar" id="progressBar"></div></div>
    <p class="status" id="status"></p>
  </div>
  <script>
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const uploadBtn = document.getElementById('uploadBtn');
    const progress = document.getElementById('progress');
    const progressBar = document.getElementById('progressBar');
    const status = document.getElementById('status');
    let files = [];

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      addFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => addFiles(e.target.files));

    function addFiles(newFiles) {
      files = [...files, ...Array.from(newFiles)];
      renderFiles();
    }

    function removeFile(index) {
      files.splice(index, 1);
      renderFiles();
    }

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function renderFiles() {
      fileList.innerHTML = files.map((f, i) => 
        '<div class="file-item"><span class="name">' + f.name + '</span><span class="size">' + formatSize(f.size) + '</span><span class="remove" onclick="removeFile(' + i + ')">×</span></div>'
      ).join('');
      uploadBtn.disabled = files.length === 0;
    }

    uploadBtn.addEventListener('click', async () => {
      if (files.length === 0) return;
      uploadBtn.disabled = true;
      progress.style.display = 'block';
      status.textContent = '';
      status.className = 'status';

      const formData = new FormData();
      files.forEach(f => formData.append('files', f));

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) progressBar.style.width = (e.loaded / e.total * 100) + '%';
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          status.textContent = '✓ ' + files.length + ' file(s) uploaded successfully!';
          status.className = 'status success';
          files = [];
          renderFiles();
        } else {
          status.textContent = '✗ Upload failed: ' + xhr.statusText;
          status.className = 'status error';
        }
        setTimeout(() => { progress.style.display = 'none'; progressBar.style.width = '0%'; }, 1000);
        uploadBtn.disabled = false;
      };
      xhr.onerror = () => {
        status.textContent = '✗ Upload failed';
        status.className = 'status error';
        uploadBtn.disabled = false;
      };
      xhr.open('POST', '/upload');
      xhr.send(formData);
    });
  </script>
</body>
</html>`;

