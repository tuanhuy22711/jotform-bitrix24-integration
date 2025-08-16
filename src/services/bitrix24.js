const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

const bitrix24Client = axios.create({
  baseURL: config.bitrix24.restUrl,
  timeout: 15000
});

/**
 * Tạo lead trong Bitrix24
 * @param {Object} contactData - Thông tin liên hệ
 * @returns {Promise<Object>} Kết quả tạo lead
 */
async function createLead(contactData) {
  try {
    // Chuẩn bị data cho Bitrix24
    const leadFields = {
      TITLE: `Lead từ Jotform - ${contactData.fullName}`,
      NAME: extractFirstName(contactData.fullName),
      LAST_NAME: extractLastName(contactData.fullName),
      SOURCE_ID: 'WEB',
      STATUS_ID: 'NEW',
      COMMENTS: `Đã gửi qua Jotform vào ${new Date(contactData.submittedAt).toLocaleString('vi-VN')}\nSubmission ID: ${contactData.submissionId}`
    };

    // Thêm email
    if (contactData.email) {
      leadFields.EMAIL = [{
        VALUE: contactData.email,
        VALUE_TYPE: 'WORK'
      }];
    }

    // Thêm phone
    if (contactData.phone) {
      leadFields.PHONE = [{
        VALUE: contactData.phone,
        VALUE_TYPE: 'WORK'
      }];
    }

    logger.info('Creating lead in Bitrix24', {
      title: leadFields.TITLE,
      email: contactData.email,
      phone: contactData.phone
    });

    // Gọi API Bitrix24
    const response = await bitrix24Client.post('crm.lead.add.json', {
      FIELDS: leadFields
    });

    if (response.data && response.data.result) {
      const leadId = response.data.result;
      
      logger.info('Lead created successfully', {
        leadId,
        submissionId: contactData.submissionId
      });

      return {
        success: true,
        leadId
      };
    } else {
      throw new Error(`Bitrix24 API error: ${response.data?.error_description || 'Unknown error'}`);
    }

  } catch (error) {
    logger.error('Failed to create lead in Bitrix24', {
      error: error.message,
      contactData: {
        fullName: contactData.fullName,
        email: contactData.email,
        phone: contactData.phone
      },
      response: error.response?.data
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test kết nối Bitrix24
 * @returns {Promise<Object>} Kết quả test
 */
async function testConnection() {
  try {
    const response = await bitrix24Client.get('crm.lead.fields.json');
    
    if (response.data && response.data.result) {
      return {
        success: true,
        message: 'Bitrix24 connection is working'
      };
    } else {
      return {
        success: false,
        error: 'Invalid API response'
      };
    }
  } catch (error) {
    logger.error('Bitrix24 connection test failed', {
      error: error.message,
      response: error.response?.data
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Lấy tên đầu từ họ tên đầy đủ
 */
function extractFirstName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts[0] || '';
}

/**
 * Lấy họ từ họ tên đầy đủ
 */
function extractLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts.slice(1).join(' ') || '';
}

module.exports = {
  createLead,
  testConnection
};
