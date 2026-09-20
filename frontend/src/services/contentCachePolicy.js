const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isScheduleRecord(record) {
  return Boolean(record && UUID_PATTERN.test(record.id)
    && typeof record.title === 'string'
    && typeof record.start_date === 'string'
    && typeof record.start_time === 'string'
    && typeof record.category === 'string');
}

function isVendorRecord(record) {
  return Boolean(record && UUID_PATTERN.test(record.id)
    && typeof record.name === 'string'
    && typeof record.type === 'string');
}

function shouldAcceptReplacement(previousCount, nextCount, response) {
  if (previousCount <= 0 || nextCount > 0) return true;
  return response?.authoritative_empty === true && response?.total_count === 0;
}

module.exports = { isScheduleRecord, isVendorRecord, shouldAcceptReplacement };
