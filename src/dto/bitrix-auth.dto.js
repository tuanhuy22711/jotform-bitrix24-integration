/**
 * Bitrix24 Authentication Data Transfer Object
 */

/**
 * Bitrix24 authentication data structure
 */
class BitrixAuthDto {
  constructor(data = {}) {
    // OAuth2 fields
    this.access_token = data.access_token;
    this.refresh_token = data.refresh_token;
    this.expires_in = data.expires_in;
    this.scope = data.scope;
    this.domain = data.domain;
    this.client_endpoint = data.client_endpoint;
    this.server_endpoint = data.server_endpoint;
    this.member_id = data.member_id;
    this.status = data.status;
    this.application_token = data.application_token;

    // Legacy fields (from installation event)
    this.AUTH_ID = data.AUTH_ID;
    this.REFRESH_ID = data.REFRESH_ID;
    this.AUTH_EXPIRES = data.AUTH_EXPIRES;
    this.DOMAIN = data.DOMAIN;
    this.PLACEMENT = data.PLACEMENT;
    this.PROTOCOL = data.PROTOCOL;
    this.LANG = data.LANG;
    this.APP_SID = data.APP_SID;

    // Additional fields
    this.method = data.method;
    this.placement = data.placement;
    this.authExpires = data.authExpires;
    this.lang = data.lang;
    this.appSid = data.appSid;
  }
}

/**
 * Token data structure for storage
 */
class TokenData {
  constructor(data = {}) {
    this.id = data.id;
    this.access_token = data.access_token;
    this.refresh_token = data.refresh_token;
    this.expires_in = data.expires_in;
    this.expires_at = data.expires_at;
    this.domain = data.domain;
    this.scope = data.scope;
    this.client_endpoint = data.client_endpoint;
    this.server_endpoint = data.server_endpoint;
    this.member_id = data.member_id;
    this.status = data.status;
    this.application_token = data.application_token;
    this.method = data.method;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }
}

/**
 * API response structure
 */
class ApiResponse {
  constructor(data = {}) {
    this.success = data.success || false;
    this.result = data.result;
    this.total = data.total;
    this.time = data.time;
    this.next = data.next;
    this.error = data.error;
    this.error_description = data.error_description;
  }
}

module.exports = {
  BitrixAuthDto,
  TokenData,
  ApiResponse
};
