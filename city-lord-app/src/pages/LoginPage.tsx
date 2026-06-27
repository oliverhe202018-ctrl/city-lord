import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { toast } from 'sonner';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { isNativePlatform } from '../lib/capacitor/safe-plugins';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [tab, setTab] = useState<'code' | 'password'>('code');
  const [registerMode, setRegisterMode] = useState<'phone' | 'email'>('phone');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const { loginWithPassword, loginWithCode, sendCode, isAuthenticated } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    const setupKeyboard = async () => {
      if (await isNativePlatform()) {
        try {
          await Keyboard.setResizeMode({ mode: KeyboardResize.None });
        } catch (e) {
          console.warn('Keyboard setResizeMode None failed', e);
        }
      }
    };
    setupKeyboard();

    return () => {
      const restoreKeyboard = async () => {
        if (await isNativePlatform()) {
          try {
            await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
          } catch (e) {
            console.warn('Keyboard setResizeMode Body failed', e);
          }
        }
      };
      restoreKeyboard();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    if (!account) {
      toast.error('请输入手机号或邮箱');
      return;
    }
    if (mode === 'register') {
      if (registerMode === 'email') {
        if (!account.includes('@') || !account.includes('.')) {
          toast.error('请输入正确的邮箱');
          return;
        }
      }
      if (!password || password.length < 6) {
        toast.error('密码长度至少6位');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('两次密码输入不一致');
        return;
      }
    }
    try {
      await sendCode(account, mode === 'register' ? 'register' : 'login', mode === 'register' ? password : undefined);
      toast.success('验证码已发送');
      setCountdown(60);
    } catch (err: any) {
      toast.error(err.message || '发送验证码失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      toast.error('请输入手机号或邮箱');
      return;
    }
    
    setLoading(true);
    try {
      if (mode === 'register') {
        if (!code) {
          toast.error('请输入验证码');
          setLoading(false);
          return;
        }
        if (!password || password.length < 6) {
          toast.error('密码长度至少6位');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          toast.error('两次密码输入不一致');
          setLoading(false);
          return;
        }
        await loginWithCode(account, code, 'register');
        toast.success('注册成功');
      } else if (tab === 'code') {
        if (!code) {
          toast.error('请输入验证码');
          setLoading(false);
          return;
        }
        await loginWithCode(account, code, 'login');
        toast.success('登录成功');
      } else {
        if (!password) {
          toast.error('请输入密码');
          setLoading(false);
          return;
        }
        await loginWithPassword(account, password);
        toast.success('登录成功');
      }
      navigate('/home', { replace: true });
    } catch (err: any) {
      toast.error(err.message || (mode === 'register' ? '注册失败' : '登录失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black overflow-y-auto overscroll-none">
      <div className="p-4">
        <div className="mx-auto mt-[12vh] w-full max-w-sm bg-neutral-900 p-8 rounded-3xl shadow-2xl border border-neutral-800 transition-all duration-300">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-green-500 tracking-widest mb-2">城市领主</h2>
            <p className="text-sm text-neutral-400 tracking-wider">用脚步丈量城市，用汗水铸就领地</p>
          </div>
          
          {mode === 'login' ? (
            <>
              {/* Tabs */}
              <div className="flex bg-neutral-800 rounded-xl p-1 mb-8">
                <button 
                  type="button"
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'code' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-400'}`}
                  onClick={() => setTab('code')}
                >
                  验证码登录
                </button>
                <button 
                  type="button"
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'password' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-400'}`}
                  onClick={() => setTab('password')}
                >
                  密码登录
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">账号</label>
                  <input 
                    type="text" 
                    placeholder="手机号 / 邮箱"
                    value={account}
                    onChange={e => setAccount(e.target.value)}
                    className="w-full bg-neutral-800/50 text-white rounded-xl px-4 py-3 border border-neutral-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-neutral-800 outline-none transition-all placeholder:text-neutral-600"
                    required
                  />
                </div>
                
                {tab === 'code' ? (
                  <div>
                    <label className="block text-sm text-neutral-400 mb-2">验证码</label>
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        placeholder="6位验证码"
                        value={code}
                        maxLength={6}
                        onChange={e => setCode(e.target.value)}
                        className="w-full bg-neutral-800/50 text-white rounded-xl px-4 py-3 border border-neutral-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-neutral-800 outline-none transition-all placeholder:text-neutral-600"
                        required
                      />
                      <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={countdown > 0 || !account}
                        className="whitespace-nowrap px-4 bg-neutral-800 text-blue-400 text-sm font-medium rounded-xl border border-neutral-700 hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:hover:bg-neutral-800"
                      >
                        {countdown > 0 ? `${countdown}s` : '获取验证码'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm text-neutral-400 mb-2">密码</label>
                    <input 
                      type="password" 
                      placeholder="请输入密码"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-neutral-800/50 text-white rounded-xl px-4 py-3 border border-neutral-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-neutral-800 outline-none transition-all placeholder:text-neutral-600"
                      required
                    />
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 mt-8 active:scale-[0.98]"
                >
                  {loading ? '正在登录...' : '登 录'}
                </button>
              </form>

              <p className="text-center text-sm text-neutral-500 mt-6">
                还没有账号？
                <button
                  type="button"
                  onClick={() => { setMode('register'); setCountdown(0); setCode(''); setPassword(''); setConfirmPassword(''); }}
                  className="text-green-400 hover:text-green-300 font-medium ml-1 transition-colors"
                >
                  立即注册
                </button>
              </p>
            </>
          ) : (
            <>
              {/* Register Mode Tabs */}
              <div className="flex bg-neutral-800 rounded-xl p-1 mb-8">
                <button 
                  type="button"
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${registerMode === 'phone' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-400'}`}
                  onClick={() => { setRegisterMode('phone'); setAccount(''); setCode(''); setPassword(''); setConfirmPassword(''); setCountdown(0); }}
                >
                  手机号注册
                </button>
                <button 
                  type="button"
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${registerMode === 'email' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-400'}`}
                  onClick={() => { setRegisterMode('email'); setAccount(''); setCode(''); setPassword(''); setConfirmPassword(''); setCountdown(0); }}
                >
                  邮箱注册
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">{registerMode === 'phone' ? '手机号' : '邮箱'}</label>
                  <input 
                    type={registerMode === 'phone' ? 'text' : 'email'}
                    placeholder={registerMode === 'phone' ? '请输入手机号' : '请输入邮箱'}
                    value={account}
                    maxLength={registerMode === 'phone' ? 11 : undefined}
                    onChange={e => setAccount(registerMode === 'phone' ? e.target.value.replace(/\D/g, '') : e.target.value)}
                    className="w-full bg-neutral-800/50 text-white rounded-xl px-4 py-3 border border-neutral-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:bg-neutral-800 outline-none transition-all placeholder:text-neutral-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-neutral-400 mb-2">设置密码</label>
                  <input 
                    type="password" 
                    placeholder="至少6位密码"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-neutral-800/50 text-white rounded-xl px-4 py-3 border border-neutral-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:bg-neutral-800 outline-none transition-all placeholder:text-neutral-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-neutral-400 mb-2">确认密码</label>
                  <input 
                    type="password" 
                    placeholder="再次输入密码"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-neutral-800/50 text-white rounded-xl px-4 py-3 border border-neutral-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:bg-neutral-800 outline-none transition-all placeholder:text-neutral-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-neutral-400 mb-2">验证码</label>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="6位验证码"
                      value={code}
                      maxLength={6}
                      onChange={e => setCode(e.target.value)}
                      className="w-full bg-neutral-800/50 text-white rounded-xl px-4 py-3 border border-neutral-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:bg-neutral-800 outline-none transition-all placeholder:text-neutral-600"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={countdown > 0 || !account}
                      className="whitespace-nowrap px-4 bg-neutral-800 text-green-400 text-sm font-medium rounded-xl border border-neutral-700 hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:hover:bg-neutral-800"
                    >
                      {countdown > 0 ? `${countdown}s` : '获取验证码'}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 mt-8 active:scale-[0.98]"
                >
                  {loading ? '正在注册...' : '注 册'}
                </button>
              </form>

              <p className="text-center text-sm text-neutral-500 mt-6">
                已有账号？
                <button
                  type="button"
                  onClick={() => { setMode('login'); setCountdown(0); setCode(''); setPassword(''); setConfirmPassword(''); }}
                  className="text-green-400 hover:text-green-300 font-medium ml-1 transition-colors"
                >
                  去登录
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
