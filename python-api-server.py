"""
LongPort API Python 后端服务 - 优化版
使用官方 Python SDK 接入 API，优化数据获取逻辑
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import datetime, date, timedelta, timezone
from typing import Optional, Dict, Any, List, Union

app = Flask(__name__)
CORS(app)

DEFAULT_HOST = '0.0.0.0'
DEFAULT_PORT = 5000
DEFAULT_BATCH_SIZE = 50
EXPIRY_DAYS_LIMIT = 45
SYMBOL_SUFFIX_US = '.US'
SYMBOL_SUFFIX_HK = '.HK'

try:
    from longport.openapi import Config, QuoteContext, TradeContext
    LONGPORT_SDK_AVAILABLE = True
    print("✓ LongPort Python SDK 已加载")
except ImportError as e:
    LONGPORT_SDK_AVAILABLE = False
    print(f"✗ LongPort Python SDK 未安装: {e}")
    print("请运行: pip install longport")


def get_config_from_request() -> Dict[str, Optional[str]]:
    """从请求中获取配置"""
    headers = request.headers
    return {
        'app_key': headers.get('X-Api-Key'),
        'app_secret': headers.get('X-Api-Secret'),
        'access_token': headers.get('Authorization'),
    }


def create_sdk_config(config_dict: Dict[str, Optional[str]]) -> Config:
    """创建 SDK 配置对象"""
    if not LONGPORT_SDK_AVAILABLE:
        raise Exception("LongPort Python SDK 未安装")
    
    os.environ['LONGPORT_APP_KEY'] = config_dict.get('app_key', '')
    os.environ['LONGPORT_APP_SECRET'] = config_dict.get('app_secret', '')
    os.environ['LONGPORT_ACCESS_TOKEN'] = config_dict.get('access_token', '')
    
    return Config.from_env()


def parse_numeric(value: Any) -> float:
    """安全解析数值"""
    if value is None:
        return 0.0
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


def format_symbol(symbol: str) -> str:
    """格式化股票代码，添加 .US 后缀"""
    if not symbol.endswith(SYMBOL_SUFFIX_US) and not symbol.endswith(SYMBOL_SUFFIX_HK):
        return f"{symbol}{SYMBOL_SUFFIX_US}"
    return symbol


def parse_expiry_date(expiry_date: str) -> date:
    """解析到期日"""
    expiry_date_str = expiry_date.replace('/', '-').replace('.', '-')
    if len(expiry_date_str) == 8 and '-' not in expiry_date_str:
        return datetime.strptime(expiry_date_str, '%Y%m%d').date()
    return datetime.strptime(expiry_date_str, '%Y-%m-%d').date()


def validate_credentials(config: Dict[str, Optional[str]]) -> bool:
    """验证凭证是否完整"""
    return all([config['app_key'], config['app_secret'], config['access_token']])


def create_error_response(message: str, status_code: int = 500, error_type: Optional[str] = None) -> tuple:
    """创建错误响应"""
    response = {'error': 'API Error', 'message': message}
    if error_type:
        response['type'] = error_type
    return jsonify(response), status_code


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({
        'status': 'ok',
        'sdk_available': LONGPORT_SDK_AVAILABLE,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/v1/account/info', methods=['GET'])
def get_account_info():
    """获取账户信息"""
    try:
        if not LONGPORT_SDK_AVAILABLE:
            return create_error_response(
                'LongPort Python SDK 未安装，请运行: pip install longport',
                503,
                'SDK not available'
            )
        
        config = get_config_from_request()
        
        if not validate_credentials(config):
            return create_error_response(
                '请提供 X-Api-Key, X-Api-Secret 和 Authorization 请求头',
                401,
                'Missing credentials'
            )
        
        sdk_config = create_sdk_config(config)
        trade_ctx = TradeContext(sdk_config)
        account_balance = trade_ctx.account_balance()
        
        return jsonify({
            'success': True,
            'data': {
                'account_id': str(getattr(account_balance, 'account_id', None)),
                'cash': str(getattr(account_balance, 'cash', None)),
                'net_assets': str(getattr(account_balance, 'net_assets', None)),
            }
        })
        
    except Exception as e:
        print(f"Error getting account info: {e}")
        return create_error_response(str(e), 500, type(e).__name__)


@app.route('/v1/option/expiry', methods=['GET'])
def get_option_expiry():
    """获取期权到期日列表"""
    try:
        if not LONGPORT_SDK_AVAILABLE:
            return create_error_response('LongPort Python SDK 未安装', 503, 'SDK not available')
        
        symbol = request.args.get('symbol')
        if not symbol:
            return create_error_response('Missing symbol parameter', 400)
        
        symbol = format_symbol(symbol)
        config = get_config_from_request()
        sdk_config = create_sdk_config(config)
        quote_ctx = QuoteContext(sdk_config)
        
        expiry_dates = quote_ctx.option_chain_expiry_date_list(symbol)
        print(f"[INFO] 获取到 {len(expiry_dates)} 个到期日")
        
        now_utc = datetime.now(timezone.utc)
        today_utc = now_utc.date()
        max_date = today_utc + timedelta(days=EXPIRY_DAYS_LIMIT)
        
        filtered_dates = []
        for date_obj in expiry_dates:
            try:
                expiry_date = _parse_date_object(date_obj)
                if today_utc <= expiry_date <= max_date:
                    filtered_dates.append(str(date_obj))
            except Exception as e:
                print(f"[WARNING] 无法解析日期 {date_obj}: {e}")
                continue
        
        print(f"[INFO] 筛选后剩余 {len(filtered_dates)} 个到期日（未来{EXPIRY_DAYS_LIMIT}天内）")
        
        return jsonify({
            'success': True,
            'symbol': symbol,
            'expiry_dates': filtered_dates,
            'today_utc': str(today_utc),
            'max_date': str(max_date)
        })
        
    except Exception as e:
        print(f"Error getting option expiry: {e}")
        import traceback
        traceback.print_exc()
        return create_error_response(str(e))


def _parse_date_object(date_obj: Union[str, date, Any]) -> date:
    """解析日期对象"""
    if isinstance(date_obj, str):
        date_str = date_obj.replace('-', '').replace('/', '')
        return date(
            int(date_str[:4]),
            int(date_str[4:6]),
            int(date_str[6:8])
        )
    if isinstance(date_obj, date):
        return date_obj
    return date.fromisoformat(str(date_obj))


@app.route('/v1/option/chain', methods=['GET'])
def get_option_chain():
    """获取期权链数据 - 优化版"""
    try:
        if not LONGPORT_SDK_AVAILABLE:
            return create_error_response('LongPort Python SDK 未安装', 503, 'SDK not available')
        
        symbol = request.args.get('symbol')
        expiry_date = request.args.get('expiry_date')
        
        if not symbol:
            return create_error_response('Missing symbol parameter', 400)
        if not expiry_date:
            return create_error_response(
                '请先获取期权到期日列表，然后选择其中一个日期',
                400,
                'Missing expiry_date parameter'
            )
        
        symbol = format_symbol(symbol)
        config = get_config_from_request()
        sdk_config = create_sdk_config(config)
        quote_ctx = QuoteContext(sdk_config)
        
        underlying_data = _get_underlying_data(quote_ctx, symbol)
        expiry_date_obj = parse_expiry_date(expiry_date)
        chain = quote_ctx.option_chain_info_by_date(symbol, expiry_date_obj)
        
        print(f"[INFO] 获取到 {len(chain)} 条期权链数据")
        
        option_symbols, strike_info = _extract_option_symbols(chain)
        print(f"[INFO] 收集了 {len(option_symbols)} 个期权合约代码")
        
        options_data = _fetch_option_quotes(quote_ctx, option_symbols, strike_info)
        
        sorted_options = sorted(options_data.values(), key=lambda x: x['strike'])
        print(f"[INFO] 整理完成，共 {len(sorted_options)} 个行权价数据")
        
        summary = _calculate_summary(sorted_options)
        
        return jsonify({
            'success': True,
            'symbol': symbol,
            'expiry_date': expiry_date,
            'underlying': underlying_data,
            'summary': summary,
            'options': sorted_options
        })
        
    except Exception as e:
        print(f"Error getting option chain: {e}")
        import traceback
        traceback.print_exc()
        return create_error_response(str(e))


def _get_underlying_data(quote_ctx: QuoteContext, symbol: str) -> Dict[str, float]:
    """获取标的资产数据"""
    underlying_last_price = 0.0
    underlying_prev_close = 0.0
    try:
        print(f"[INFO] 获取标的资产 {symbol} 的现价...")
        underlying_quotes = quote_ctx.quote([symbol])
        if underlying_quotes and len(underlying_quotes) > 0:
            underlying_quote = underlying_quotes[0]
            underlying_last_price = parse_numeric(getattr(underlying_quote, 'last_done', None))
            underlying_prev_close = parse_numeric(getattr(underlying_quote, 'prev_close', None))
            print(f"[INFO] 标的资产现价: {underlying_last_price}, 昨收: {underlying_prev_close}")
    except Exception as e:
        print(f"[WARNING] 获取标的资产现价失败: {e}")
    return {
        'last_price': underlying_last_price,
        'prev_close': underlying_prev_close,
    }


def _extract_option_symbols(chain: List[Any]) -> tuple[List[str], Dict[str, Dict[str, Any]]]:
    """提取期权合约代码"""
    option_symbols = []
    strike_info = {}
    
    for item in chain:
        try:
            strike = _extract_strike_price(item)
            if not strike or strike <= 0:
                continue
            
            if hasattr(item, 'call_symbol') and item.call_symbol:
                call_symbol = item.call_symbol
                option_symbols.append(call_symbol)
                strike_info[call_symbol] = {'strike': strike, 'type': 'call'}
            
            if hasattr(item, 'put_symbol') and item.put_symbol:
                put_symbol = item.put_symbol
                option_symbols.append(put_symbol)
                strike_info[put_symbol] = {'strike': strike, 'type': 'put'}
        except Exception as e:
            print(f"[WARNING] 处理期权代码时出错: {e}")
            continue
    
    return option_symbols, strike_info


def _extract_strike_price(item: Any) -> float:
    """从期权链项中提取行权价"""
    if hasattr(item, 'price'):
        return parse_numeric(item.price)
    if hasattr(item, 'strike_price'):
        return parse_numeric(item.strike_price)
    if hasattr(item, 'strike'):
        return parse_numeric(item.strike)
    return 0.0


def _fetch_option_quotes(
    quote_ctx: QuoteContext,
    option_symbols: List[str],
    strike_info: Dict[str, Dict[str, Any]]
) -> Dict[float, Dict[str, Any]]:
    """批量获取期权行情数据"""
    options_data: Dict[float, Dict[str, Any]] = {}
    total_quotes = 0
    
    if not option_symbols:
        return options_data
    
    try:
        for i in range(0, len(option_symbols), DEFAULT_BATCH_SIZE):
            batch = option_symbols[i:i + DEFAULT_BATCH_SIZE]
            try:
                quotes = quote_ctx.option_quote(batch)
                total_quotes += len(quotes)
                
                for quote in quotes:
                    _process_option_quote(quote, strike_info, options_data)
                    
            except Exception as batch_error:
                print(f"[WARNING] 获取批次行情时出错: {batch_error}")
                continue
        
        print(f"[INFO] 共获取 {total_quotes} 条期权行情数据")
        
    except Exception as e:
        print(f"[ERROR] 获取期权行情时出错: {e}")
        import traceback
        traceback.print_exc()
    
    return options_data


def _process_option_quote(
    quote: Any,
    strike_info: Dict[str, Dict[str, Any]],
    options_data: Dict[float, Dict[str, Any]]
) -> None:
    """处理单个期权行情数据"""
    try:
        symbol_code = getattr(quote, 'symbol', None)
        if not symbol_code or symbol_code not in strike_info:
            return
        
        strike = strike_info[symbol_code]['strike']
        opt_type = strike_info[symbol_code]['type']
        
        if strike not in options_data:
            options_data[strike] = {
                'strike': strike,
                'callOI': 0,
                'putOI': 0,
                'callVolume': 0,
                'putVolume': 0,
                'callIV': 0,
                'putIV': 0,
                'callLastPrice': 0,
                'putLastPrice': 0,
                'historicalVolatility': 0,
            }
        
        oi = parse_numeric(getattr(quote, 'open_interest', 0))
        iv = parse_numeric(getattr(quote, 'implied_volatility', 0))
        hv = parse_numeric(getattr(quote, 'historical_volatility', 0))
        volume = parse_numeric(getattr(quote, 'volume', 0))
        last_price = parse_numeric(getattr(quote, 'last_done', 0))
        
        if hv > 0:
            options_data[strike]['historicalVolatility'] = hv
        
        if opt_type == 'call':
            options_data[strike]['callOI'] = int(oi)
            options_data[strike]['callVolume'] = int(volume)
            options_data[strike]['callIV'] = iv
            options_data[strike]['callLastPrice'] = last_price
        else:
            options_data[strike]['putOI'] = int(oi)
            options_data[strike]['putVolume'] = int(volume)
            options_data[strike]['putIV'] = iv
            options_data[strike]['putLastPrice'] = last_price
            
    except Exception as e:
        print(f"[WARNING] 解析单个期权数据时出错: {e}")


def _calculate_summary(sorted_options: List[Dict[str, Any]]) -> Dict[str, Any]:
    """计算汇总数据"""
    total_call_oi = sum(opt['callOI'] for opt in sorted_options)
    total_put_oi = sum(opt['putOI'] for opt in sorted_options)
    total_call_volume = sum(opt['callVolume'] for opt in sorted_options)
    total_put_volume = sum(opt['putVolume'] for opt in sorted_options)
    
    hv_values = [opt['historicalVolatility'] for opt in sorted_options if opt['historicalVolatility'] > 0]
    avg_hv = sum(hv_values) / len(hv_values) if hv_values else 0
    
    return {
        'total_call_oi': total_call_oi,
        'total_put_oi': total_put_oi,
        'total_call_volume': total_call_volume,
        'total_put_volume': total_put_volume,
        'avg_historical_volatility': avg_hv,
    }


@app.route('/test-connection', methods=['POST'])
def test_connection():
    """测试 API 连接"""
    try:
        if not LONGPORT_SDK_AVAILABLE:
            return jsonify({
                'success': False,
                'error': 'SDK not available',
                'message': 'LongPort Python SDK 未安装，请运行: pip install longport'
            }), 503
        
        data = request.get_json() or {}
        config = {
            'app_key': data.get('appKey'),
            'app_secret': data.get('appSecret'),
            'access_token': data.get('accessToken'),
        }
        
        if not validate_credentials(config):
            return jsonify({
                'success': False,
                'error': 'Missing credentials',
                'message': '请提供完整的 API 凭证'
            }), 401
        
        sdk_config = create_sdk_config(config)
        quote_ctx = QuoteContext(sdk_config)
        test_quotes = quote_ctx.quote(['SPY.US'])
        
        return jsonify({
            'success': True,
            'message': '连接成功',
            'test_data': {
                'symbol': 'SPY.US',
                'has_data': len(test_quotes) > 0
            }
        })
        
    except Exception as e:
        print(f"Connection test failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': 'Connection failed',
            'message': str(e),
            'type': type(e).__name__
        }), 500


if __name__ == '__main__':
    print("=" * 60)
    print("LongPort API Python 后端服务 - 优化版")
    print("=" * 60)
    
    if not LONGPORT_SDK_AVAILABLE:
        print("\n警告: LongPort Python SDK 未安装")
        print("请先安装 SDK: pip install longport")
        print("\n服务将以受限模式启动...\n")
    
    print(f"服务地址: http://{DEFAULT_HOST}:{DEFAULT_PORT}")
    print(f"健康检查: http://{DEFAULT_HOST}:{DEFAULT_PORT}/health")
    print(f"测试连接: POST http://{DEFAULT_HOST}:{DEFAULT_PORT}/test-connection")
    print("\n按 Ctrl+C 停止服务")
    print("=" * 60)
    
    app.run(host=DEFAULT_HOST, port=DEFAULT_PORT, debug=False)
