"""
LongPort API Python 后端服务 - 重构版
使用官方 Python SDK 接入 API，优化数据获取逻辑
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from datetime import datetime, date, timedelta, timezone

app = Flask(__name__)
CORS(app)  # 启用 CORS

# 尝试导入 LongPort SDK
try:
    from longport.openapi import Config, QuoteContext, TradeContext
    LONGPORT_SDK_AVAILABLE = True
    print("✓ LongPort Python SDK 已加载")
except ImportError as e:
    LONGPORT_SDK_AVAILABLE = False
    print(f"✗ LongPort Python SDK 未安装: {e}")
    print("请运行: pip install longport")


def get_config_from_request():
    """从请求中获取配置"""
    headers = request.headers
    return {
        'app_key': headers.get('X-Api-Key'),
        'app_secret': headers.get('X-Api-Secret'),
        'access_token': headers.get('Authorization'),
    }


def create_sdk_config(config_dict):
    """创建 SDK 配置对象"""
    if not LONGPORT_SDK_AVAILABLE:
        raise Exception("LongPort Python SDK 未安装")
    
    # 设置环境变量（LongPort SDK 使用 LONGPORT_ 前缀）
    os.environ['LONGPORT_APP_KEY'] = config_dict.get('app_key', '')
    os.environ['LONGPORT_APP_SECRET'] = config_dict.get('app_secret', '')
    os.environ['LONGPORT_ACCESS_TOKEN'] = config_dict.get('access_token', '')
    
    # 从环境变量创建配置
    return Config.from_env()


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
    """获取账户信息 - 用于测试连接"""
    try:
        if not LONGPORT_SDK_AVAILABLE:
            return jsonify({
                'error': 'SDK not available',
                'message': 'LongPort Python SDK 未安装，请运行: pip install longport'
            }), 503
        
        config = get_config_from_request()
        
        # 检查必要的配置
        if not all([config['app_key'], config['app_secret'], config['access_token']]):
            return jsonify({
                'error': 'Missing credentials',
                'message': '请提供 X-Api-Key, X-Api-Secret 和 Authorization 请求头'
            }), 401
        
        # 创建配置和上下文
        sdk_config = create_sdk_config(config)
        
        # 尝试创建 TradeContext 来获取账户信息
        trade_ctx = TradeContext(sdk_config)
        
        # 获取账户余额信息
        account_balance = trade_ctx.account_balance()
        
        return jsonify({
            'success': True,
            'data': {
                'account_id': str(account_balance.account_id) if hasattr(account_balance, 'account_id') else None,
                'cash': str(account_balance.cash) if hasattr(account_balance, 'cash') else None,
                'net_assets': str(account_balance.net_assets) if hasattr(account_balance, 'net_assets') else None,
            }
        })
        
    except Exception as e:
        print(f"Error getting account info: {e}")
        return jsonify({
            'error': 'API Error',
            'message': str(e),
            'type': type(e).__name__
        }), 500


@app.route('/v1/option/expiry', methods=['GET'])
def get_option_expiry():
    """获取期权到期日列表（只返回未来45天内的到期日，使用美东时间）"""
    try:
        if not LONGPORT_SDK_AVAILABLE:
            return jsonify({
                'error': 'SDK not available',
                'message': 'LongPort Python SDK 未安装'
            }), 503
        
        symbol = request.args.get('symbol')
        if not symbol:
            return jsonify({'error': 'Missing symbol parameter'}), 400
        
        # 格式化股票代码，添加 .US 后缀
        if not symbol.endswith('.US') and not symbol.endswith('.HK'):
            symbol = f"{symbol}.US"
        
        config = get_config_from_request()
        sdk_config = create_sdk_config(config)
        
        # 创建 QuoteContext
        quote_ctx = QuoteContext(sdk_config)
        
        # 获取期权到期日
        expiry_dates = quote_ctx.option_chain_expiry_date_list(symbol)
        
        print(f"[INFO] 获取到 {len(expiry_dates)} 个到期日")
        
        # 使用 UTC 时间并过滤45天内的到期日
        now_utc = datetime.now(timezone.utc)
        today_utc = now_utc.date()
        
        # 计算45天后的日期
        max_date = today_utc + timedelta(days=45)
        
        filtered_dates = []
        for date_obj in expiry_dates:
            try:
                # 尝试解析日期
                if isinstance(date_obj, str):
                    date_str = date_obj.replace('-', '').replace('/', '')
                    expiry_date = date(
                        int(date_str[:4]),
                        int(date_str[4:6]),
                        int(date_str[6:8])
                    )
                elif isinstance(date_obj, date):
                    expiry_date = date_obj
                else:
                    expiry_date = date.fromisoformat(str(date_obj))
                
                # 只保留今天到45天内的日期
                if today_utc <= expiry_date <= max_date:
                    filtered_dates.append(str(date_obj))
            except Exception as e:
                print(f"[WARNING] 无法解析日期 {date_obj}: {e}")
                continue
        
        print(f"[INFO] 筛选后剩余 {len(filtered_dates)} 个到期日（未来45天内）")
        
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
        return jsonify({
            'error': 'API Error',
            'message': str(e)
        }), 500


def parse_numeric(value):
    """安全解析数值"""
    if value is None:
        return 0
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0


@app.route('/v1/option/chain', methods=['GET'])
def get_option_chain():
    """获取期权链数据 - 重构版
    
    使用 LongPort API 获取完整的期权数据，包括：
    - 标的资产现价
    - 各期权的 IV、OI、成交量、历史波动率等
    
    数据流程：
    1. 获取期权到期日的所有行权价列表
    2. 构建所有期权合约代码
    3. 批量获取所有期权的详细行情数据
    4. 整理并返回结构化数据
    """
    try:
        if not LONGPORT_SDK_AVAILABLE:
            return jsonify({
                'error': 'SDK not available',
                'message': 'LongPort Python SDK 未安装'
            }), 503
        
        symbol = request.args.get('symbol')
        expiry_date = request.args.get('expiry_date')
        
        if not symbol:
            return jsonify({'error': 'Missing symbol parameter'}), 400
        
        # 格式化股票代码，添加 .US 后缀
        if not symbol.endswith('.US') and not symbol.endswith('.HK'):
            symbol = f"{symbol}.US"
        
        if not expiry_date:
            return jsonify({
                'error': 'Missing expiry_date parameter',
                'message': '请先获取期权到期日列表，然后选择其中一个日期'
            }), 400
        
        config = get_config_from_request()
        sdk_config = create_sdk_config(config)
        
        # 创建 QuoteContext
        quote_ctx = QuoteContext(sdk_config)
        
        # ===== 步骤 1: 获取标的资产的现价 =====
        underlying_last_price = None
        underlying_prev_close = None
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
            import traceback
            traceback.print_exc()
        
        # ===== 步骤 2: 解析到期日 =====
        try:
            expiry_date_str = expiry_date.replace('/', '-').replace('.', '-')
            if len(expiry_date_str) == 8 and '-' not in expiry_date_str:
                expiry_date_obj = datetime.strptime(expiry_date_str, '%Y%m%d').date()
            else:
                expiry_date_obj = datetime.strptime(expiry_date_str, '%Y-%m-%d').date()
        except ValueError as e:
            return jsonify({
                'error': 'Invalid date format',
                'message': f'无法解析日期 {expiry_date}，请使用 YYYY-MM-DD 格式'
            }), 400
        
        # ===== 步骤 3: 获取期权链的行权价列表 =====
        try:
            chain = quote_ctx.option_chain_info_by_date(symbol, expiry_date_obj)
            print(f"[INFO] 获取到 {len(chain)} 条期权链数据")
            
            # 打印第一个期权链项的信息用于调试
            if len(chain) > 0:
                first_item = chain[0]
                print(f"[DEBUG] 第一个期权链项类型: {type(first_item)}")
                print(f"[DEBUG] 第一个期权链项属性: {dir(first_item)}")
                
                # 打印所有属性的值
                print(f"[DEBUG] 第一个期权链项完整数据:")
                for attr in dir(first_item):
                    if not attr.startswith('_'):
                        try:
                            value = getattr(first_item, attr)
                            print(f"  {attr}: {value}")
                        except:
                            pass
        except Exception as e:
            print(f"[ERROR] 获取期权链失败: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'error': 'Failed to get option chain',
                'message': str(e)
            }), 500
        
        # ===== 步骤 4: 使用期权链提供的合约代码 =====
        option_symbols = []
        strike_info = {}  # 存储期权代码对应的行权价和类型
        
        for item in chain:
            try:
                # 获取行权价
                strike = None
                if hasattr(item, 'price'):
                    strike = parse_numeric(item.price)
                elif hasattr(item, 'strike_price'):
                    strike = parse_numeric(item.strike_price)
                elif hasattr(item, 'strike'):
                    strike = parse_numeric(item.strike)
                
                if strike and strike > 0:
                    # 直接使用期权链提供的 call_symbol 和 put_symbol
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
        
        print(f"[INFO] 收集了 {len(option_symbols)} 个期权合约代码")
        
        # 打印前5个期权合约代码用于调试
        if len(option_symbols) > 0:
            print(f"[DEBUG] 前5个期权合约代码:")
            for i in range(min(5, len(option_symbols))):
                print(f"  {i+1}. {option_symbols[i]}")
        
        # ===== 步骤 5: 批量获取所有期权的详细行情数据 =====
        options_data = {}  # 按行权价组织数据
        total_quotes = 0
        
        if option_symbols:
            try:
                batch_size = 50
                for i in range(0, len(option_symbols), batch_size):
                    batch = option_symbols[i:i+batch_size]
                    
                    try:
                        quotes = quote_ctx.option_quote(batch)
                        total_quotes += len(quotes)
                        
                        # 打印第一个 quote 的信息用于调试
                        if i == 0 and len(quotes) > 0:
                            first_quote = quotes[0]
                            print(f"[DEBUG] 第一个 quote 类型: {type(first_quote)}")
                            print(f"[DEBUG] 第一个 quote 属性: {dir(first_quote)}")
                        
                        # 解析每个期权的数据
                        for quote_idx, quote in enumerate(quotes):
                            try:
                                symbol_code = getattr(quote, 'symbol', None)
                                if not symbol_code or symbol_code not in strike_info:
                                    continue
                                
                                strike = strike_info[symbol_code]['strike']
                                opt_type = strike_info[symbol_code]['type']
                                
                                # 打印前3个期权的详细数据用于调试
                                if quote_idx < 3:
                                    print(f"[DEBUG] 期权 {quote_idx} ({symbol_code}):")
                                    for attr in dir(quote):
                                        if not attr.startswith('_'):
                                            try:
                                                value = getattr(quote, attr)
                                                print(f"  {attr}: {value}")
                                            except:
                                                pass
                                
                                # 初始化该行权价的数据结构
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
                                
                                # 获取 OI - 直接从 quote 对象获取
                                oi = 0
                                if hasattr(quote, 'open_interest'):
                                    oi = parse_numeric(quote.open_interest)
                                
                                # 获取 IV - 直接从 quote 对象获取
                                iv = 0
                                if hasattr(quote, 'implied_volatility'):
                                    iv = parse_numeric(quote.implied_volatility)
                                
                                # 获取历史波动率 - 直接从 quote 对象获取
                                hv = 0
                                if hasattr(quote, 'historical_volatility'):
                                    hv = parse_numeric(quote.historical_volatility)
                                    if hv > 0:
                                        options_data[strike]['historicalVolatility'] = hv
                                
                                # 获取成交量
                                volume = parse_numeric(getattr(quote, 'volume', 0))
                                
                                # 获取期权最新成交价
                                last_price = parse_numeric(getattr(quote, 'last_done', 0))
                                
                                # 根据类型存储数据
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
                                continue
                                
                    except Exception as batch_error:
                        print(f"[WARNING] 获取批次行情时出错: {batch_error}")
                        import traceback
                        traceback.print_exc()
                        continue
                
                print(f"[INFO] 共获取 {total_quotes} 条期权行情数据")
                
            except Exception as e:
                print(f"[ERROR] 获取期权行情时出错: {e}")
                import traceback
                traceback.print_exc()
        
        # ===== 步骤 6: 整理数据并返回 =====
        # 转换为列表并按行权价排序
        sorted_options = sorted(options_data.values(), key=lambda x: x['strike'])
        
        print(f"[INFO] 整理完成，共 {len(sorted_options)} 个行权价数据")
        
        # 打印前3个行权价的数据用于调试
        if len(sorted_options) > 0:
            print(f"[DEBUG] 前3个行权价数据:")
            for i in range(min(3, len(sorted_options))):
                opt = sorted_options[i]
                print(f"  {i+1}. Strike ${opt['strike']}: Call OI={opt['callOI']}, Put OI={opt['putOI']}, Call IV={opt['callIV']}, Put IV={opt['putIV']}")
        
        # 计算一些汇总数据
        total_call_oi = sum(opt['callOI'] for opt in sorted_options)
        total_put_oi = sum(opt['putOI'] for opt in sorted_options)
        total_call_volume = sum(opt['callVolume'] for opt in sorted_options)
        total_put_volume = sum(opt['putVolume'] for opt in sorted_options)
        
        # 计算平均历史波动率
        hv_values = [opt['historicalVolatility'] for opt in sorted_options if opt['historicalVolatility'] > 0]
        avg_hv = sum(hv_values) / len(hv_values) if hv_values else 0
        
        return jsonify({
            'success': True,
            'symbol': symbol,
            'expiry_date': expiry_date,
            'underlying': {
                'last_price': underlying_last_price,
                'prev_close': underlying_prev_close,
            },
            'summary': {
                'total_call_oi': total_call_oi,
                'total_put_oi': total_put_oi,
                'total_call_volume': total_call_volume,
                'total_put_volume': total_put_volume,
                'avg_historical_volatility': avg_hv,
            },
            'options': sorted_options
        })
        
    except Exception as e:
        print(f"Error getting option chain: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'API Error',
            'message': str(e)
        }), 500


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
        
        data = request.get_json()
        config = {
            'app_key': data.get('appKey'),
            'app_secret': data.get('appSecret'),
            'access_token': data.get('accessToken'),
        }
        
        if not all([config['app_key'], config['app_secret'], config['access_token']]):
            return jsonify({
                'success': False,
                'error': 'Missing credentials',
                'message': '请提供完整的 API 凭证'
            }), 401
        
        # 尝试创建配置
        sdk_config = create_sdk_config(config)
        
        # 尝试创建 QuoteContext 并测试获取一个简单的行情
        quote_ctx = QuoteContext(sdk_config)
        
        # 测试获取 SPY 的行情
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
    print("LongPort API Python 后端服务 - 重构版")
    print("=" * 60)
    
    if not LONGPORT_SDK_AVAILABLE:
        print("\n警告: LongPort Python SDK 未安装")
        print("请先安装 SDK: pip install longport")
        print("\n服务将以受限模式启动...\n")
    
    print("服务地址: http://localhost:5000")
    print("健康检查: http://localhost:5000/health")
    print("测试连接: POST http://localhost:5000/test-connection")
    print("\n按 Ctrl+C 停止服务")
    print("=" * 60)
    
    # 启动服务
    app.run(host='0.0.0.0', port=5000, debug=True)

