import axios from 'axios';

const BASE_URL = 'http://localhost:5001';
const API_URL = `${BASE_URL}/api`;

// Create axios instance with proper settings
const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  },
  proxy: false
});

// Store cookies
let cookieJar = {};

axiosInstance.interceptors.request.use(config => {
  const cookieString = Object.entries(cookieJar)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
  
  if (cookieString) {
    config.headers.Cookie = cookieString;
  }
  return config;
});

axiosInstance.interceptors.response.use(response => {
  const setCookies = response.headers['set-cookie'];
  if (setCookies) {
    setCookies.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        cookieJar[name.trim()] = value.trim();
      }
    });
  }
  return response;
});

// Main test function
async function runCoreTests() {
  console.log('\n🚀 运行核心集成测试\n');
  
  let userId = null;
  let passed = 0;
  let failed = 0;
  
  try {
    // 1. Test Authentication
    console.log('1. 测试用户认证...');
    const testUser = {
      username: 'test_' + Date.now(),
      password: 'testPassword123!',
      email: `test_${Date.now()}@example.com`,
      fullName: 'Test User'
    };
    
    const registerRes = await axiosInstance.post('/register', testUser);
    if (registerRes.status === 201) {
      console.log('✅ 用户注册成功');
      passed++;
      userId = registerRes.data.id;
    } else {
      console.log('❌ 用户注册失败');
      failed++;
    }
    
    // Test profile access
    const profileRes = await axiosInstance.get('/users/profile');
    if (profileRes.status === 200 && profileRes.data.username === testUser.username) {
      console.log('✅ 会话保持成功');
      passed++;
    } else {
      console.log('❌ 会话保持失败');
      failed++;
    }
    
    // 2. Test Events
    console.log('\n2. 测试活动系统...');
    const eventData = {
      title: '测试活动',
      description: '这是一个测试活动',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      location: '线上',
      maxAttendees: 50,
      category: 'tech_share',
      createdBy: userId
    };
    
    const eventRes = await axiosInstance.post('/events', eventData);
    if (eventRes.status === 201) {
      console.log('✅ 创建活动成功');
      passed++;
      
      // Test event registration
      const eventId = eventRes.data.id;
      const regRes = await axiosInstance.post(`/events/${eventId}/register`);
      if (regRes.status === 201 || regRes.status === 409) {
        console.log('✅ 活动报名成功');
        passed++;
      } else {
        console.log('❌ 活动报名失败');
        failed++;
      }
    } else {
      console.log('❌ 创建活动失败');
      failed++;
    }
    
    // 3. Test Search
    console.log('\n3. 测试搜索系统...');
    const searchRes = await axiosInstance.post('/search', {
      query: 'AI',
      filters: { type: ['users', 'events'] }
    });
    
    if (searchRes.status === 200 && searchRes.data.results !== undefined) {
      console.log('✅ 搜索功能正常');
      passed++;
    } else {
      console.log('❌ 搜索功能失败');
      failed++;
    }
    
    // 4. Test Reputation System
    console.log('\n4. 测试信誉系统...');
    const repInitRes = await axiosInstance.post('/reputation/initialize');
    if (repInitRes.status === 200 || repInitRes.status === 409) {
      console.log('✅ 信誉系统初始化成功');
      passed++;
      
      const repStatsRes = await axiosInstance.get('/reputation/my');
      if (repStatsRes.status === 200 && repStatsRes.data.score) {
        console.log('✅ 获取信誉统计成功');
        passed++;
      } else {
        console.log('❌ 获取信誉统计失败');
        failed++;
      }
    } else {
      console.log('❌ 信誉系统初始化失败');
      failed++;
    }
    
    // 5. Test Public Endpoints
    console.log('\n5. 测试公共端点...');
    const publicEventsRes = await axiosInstance.get('/events');
    if (publicEventsRes.status === 200 && Array.isArray(publicEventsRes.data)) {
      console.log('✅ 公共活动列表正常');
      passed++;
    } else {
      console.log('❌ 公共活动列表失败');
      failed++;
    }
    
  } catch (error) {
    console.error('\n❌ 测试过程中出错:', error.message);
    if (error.response) {
      console.error('错误详情:', error.response.data);
    }
    failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('测试总结:');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`成功率: ${((passed / (passed + failed)) * 100).toFixed(2)}%`);
  console.log('='.repeat(50) + '\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Add timeout and run tests
setTimeout(() => {
  console.error('\n❌ 测试超时');
  process.exit(1);
}, 30000);

runCoreTests().catch(error => {
  console.error('\n❌ 测试运行失败:', error);
  process.exit(1);
});