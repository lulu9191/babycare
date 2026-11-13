function pad(number) { return String(number).padStart(2, '0'); }
function dateText(date) { return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-'); }
function monthStart(year, month) { return dateText(new Date(year, month - 1, 1)); }
function monthEnd(year, month) { return dateText(new Date(year, month, 0)); }

function getRange(filters, now) {
  const today = now || new Date();
  const currentYear = today.getFullYear();
  const year = Number(filters.year || currentYear);
  let start = '';
  let end = '';
  switch (filters.type) {
    case 'recent': {
      const first = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      first.setDate(first.getDate() - 29);
      start = dateText(first); end = dateText(today); break;
    }
    case 'currentQuarter': {
      const month = Math.floor(today.getMonth() / 3) * 3 + 1;
      start = monthStart(currentYear, month); end = monthEnd(currentYear, month + 2); break;
    }
    case 'currentYear': start = monthStart(currentYear, 1); end = monthEnd(currentYear, 12); break;
    case 'year': start = monthStart(year, 1); end = monthEnd(year, 12); break;
    case 'month': start = monthStart(year, Number(filters.month)); end = monthEnd(year, Number(filters.month)); break;
    case 'quarter': {
      const month = (Number(filters.quarter) - 1) * 3 + 1;
      start = monthStart(year, month); end = monthEnd(year, month + 2); break;
    }
    case 'season': {
      const month = { spring:3, summer:6, autumn:9, winter:12 }[filters.season];
      start = monthStart(year, month);
      end = month === 12 ? monthEnd(year + 1, 2) : monthEnd(year, month + 2); break;
    }
    default: break;
  }
  return { start, end, label: start ? start + ' 至 ' + end : '全部时间 · 日期待确认的记录也会显示' };
}

module.exports = { getRange, dateText };
