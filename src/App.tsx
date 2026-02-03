import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import './App.css'
import Cropper from 'react-easy-crop'
import pinyin from 'pinyin'

type Gender = 'boy' | 'girl'

interface Kid {
  id: string
  name: string
  gender: Gender
  avatar?: string
  totalPoints: number
}

interface PointReason {
  id: string
  name: string
  points: number
}

interface Reward {
  id: string
  name: string
  points: number
}

interface Record {
  id: string
  type: 'add' | 'redeem'
  reasonId?: string
  rewardId?: string
  points: number
  timestamp: number
  description: string
  kidId: string
}

type Tab = 'overview' | 'records' | 'settings' | 'reasons' | 'rewards'
type ModalType = 'addPoints' | 'redeem' | 'editReason' | 'editReward' | 'editAvatar' | null

const RECORDS_PER_PAGE = 10

// 可搜索下拉框组件
interface SearchableSelectProps {
  options: { id: string; label: string; points: number }[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
}

function SearchableSelect({ options, value, onChange, placeholder = '搜索...', emptyText = '无匹配选项' }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  
  // 预计算拼音
  const optionsWithPinyin = useMemo(() => {
    return options.map(opt => ({
      ...opt,
      pinyin: pinyin(opt.label, { style: pinyin.STYLE_NORMAL }).join('').toLowerCase(),
      firstLetters: pinyin(opt.label, { style: pinyin.STYLE_FIRST_LETTER }).join('').toLowerCase()
    }))
  }, [options])
  
  // 过滤选项
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return optionsWithPinyin
    const term = searchTerm.toLowerCase()
    return optionsWithPinyin.filter(opt => 
      opt.label.toLowerCase().includes(term) ||
      opt.pinyin.includes(term) ||
      opt.firstLetters.includes(term)
    )
  }, [optionsWithPinyin, searchTerm])
  
  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].id)
          setIsOpen(false)
          setSearchTerm('')
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }
  
  // 虚拟滚动 - 只渲染可见项
  const VISIBLE_COUNT = 20
  const ITEM_HEIGHT = 48
  const [scrollTop, setScrollTop] = useState(0)
  
  const startIndex = Math.floor(scrollTop / ITEM_HEIGHT)
  const endIndex = Math.min(startIndex + VISIBLE_COUNT, filteredOptions.length)
  const visibleOptions = filteredOptions.slice(startIndex, endIndex)
  const topPadding = startIndex * ITEM_HEIGHT
  const bottomPadding = (filteredOptions.length - endIndex) * ITEM_HEIGHT
  
  const selectedOption = options.find(opt => opt.id === value)
  
  return (
    <div className="searchable-select">
      <div 
        className={`select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0)
          }
        }}
      >
        {selectedOption ? (
          <span className="select-value">{selectedOption.label}</span>
        ) : (
          <span className="select-placeholder">{placeholder}</span>
        )}
        <span className="select-arrow">▼</span>
      </div>
      
      {isOpen && (
        <div className="select-dropdown">
          <div className="select-search">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setHighlightedIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="select-search-input"
            />
          </div>
          
          <div 
            ref={listRef}
            className="select-options"
            style={{ height: Math.min(filteredOptions.length, VISIBLE_COUNT) * ITEM_HEIGHT }}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            {filteredOptions.length === 0 ? (
              <div className="select-empty">{emptyText}</div>
            ) : (
              <>
                <div style={{ height: topPadding }} />
                {visibleOptions.map((opt, idx) => {
                  const actualIndex = startIndex + idx
                  return (
                    <div
                      key={opt.id}
                      className={`select-option ${opt.id === value ? 'selected' : ''} ${actualIndex === highlightedIndex ? 'highlighted' : ''}`}
                      style={{ height: ITEM_HEIGHT }}
                      onClick={() => {
                        onChange(opt.id)
                        setIsOpen(false)
                        setSearchTerm('')
                      }}
                      onMouseEnter={() => setHighlightedIndex(actualIndex)}
                    >
                      <span className="option-label">{opt.label}</span>
                      <span className={`option-points ${opt.points < 0 ? 'text-warning' : ''}`}>{opt.points}分</span>
                    </div>
                  )
                })}
                <div style={{ height: bottomPadding }} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 头像裁剪组件
interface AvatarCropperProps {
  image: string
  onCropComplete: (croppedImage: string) => void
  onCancel: () => void
}

function AvatarCropper({ image, onCropComplete, onCancel }: AvatarCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  
  const onCropChange = (newCrop: any) => setCrop(newCrop)
  const onZoomChange = (newZoom: number) => setZoom(newZoom)
  const onCropAreaChange = useCallback((_: any, croppedPixels: any) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])
  
  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    
    const canvas = document.createElement('canvas')
    const img = new Image()
    img.src = image
    await new Promise(resolve => { img.onload = resolve })
    
    canvas.width = 200
    canvas.height = 200
    const ctx = canvas.getContext('2d')!
    
    ctx.drawImage(
      img,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      200,
      200
    )
    
    const base64 = canvas.toDataURL('image/jpeg', 0.8)
    onCropComplete(base64)
  }
  
  return (
    <div className="avatar-cropper">
      <div className="cropper-container">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropAreaChange={onCropAreaChange}
        />
      </div>
      <div className="zoom-control">
        <span>缩小</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
        <span>放大</span>
      </div>
      <div className="cropper-actions">
        <button className="btn" onClick={onCancel}>取消</button>
        <button className="btn btn-success" onClick={handleConfirm}>确认裁剪</button>
      </div>
    </div>
  )
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('kidcoins_theme')
    return saved ? saved === 'dark' : false
  })

  const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  }

  const defaultPointReasons: PointReason[] = [
    { id: '1', name: '早读晚诵', points: 10 },
    { id: '2', name: '提前预习', points: 5 },
    { id: '3', name: '课后复习', points: 5 },
    { id: '4', name: '认真完成作业', points: 5 },
    { id: '5', name: '阅读30分钟', points: 5 },
    { id: '6', name: '每日练字', points: 5 },
    { id: '7', name: '口算30题', points: 2 },
    { id: '8', name: '默写听写单词', points: 2 },
    { id: '9', name: '练习语数英习题页', points: 2 },
    { id: '10', name: '语文/英语打卡', points: 2 },
    { id: '11', name: '认真完成各科作业', points: 2 },
    { id: '12', name: '复习今日所学内容', points: 2 },
    { id: '13', name: '预习明日要学课程', points: 3 },
    { id: '14', name: '每日练字15分钟', points: 2 },
    { id: '15', name: '坐姿、握笔姿势标准', points: 2 },
    { id: '16', name: '课外阅读30分钟', points: 5 },
    { id: '17', name: '学习时不离开座位', points: 5 },
    { id: '18', name: '每天晨读/晚读20分钟', points: 1 },
    { id: '19', name: '每天英语磨耳朵30分钟', points: 1 },
    { id: '20', name: '每天自主完成校内作业', points: 1 },
    { id: '21', name: '连续一周完成所有课外学习计划', points: 10 },
    { id: '22', name: '连续一周完成所有阅读计划', points: 5 },
    { id: '23', name: '听算全对', points: 1 },
    { id: '24', name: '口算全对', points: 1 },
    { id: '25', name: '单元测试95以上', points: 5 },
    { id: '26', name: '获得学校的奖状', points: 10 },
    { id: '27', name: '课堂听写、默写满分', points: 5 },
    { id: '28', name: '被老师表扬', points: 2 },
    { id: '29', name: '考试成绩80-90分', points: 1 },
    { id: '30', name: '考试成绩90-100分', points: 2 },
    { id: '31', name: '考试100分', points: 5 },
    { id: '32', name: '考试有进步', points: 2 },
    { id: '33', name: '卷面干净、不乱涂画', points: 1 },
    { id: '34', name: '课堂笔记认真', points: 1 },
    { id: '35', name: '主动承认错误、学会自我反省', points: 1 },
    { id: '36', name: '准时起床', points: 5 },
    { id: '37', name: '主动洗漱', points: 3 },
    { id: '38', name: '整理床铺', points: 3 },
    { id: '39', name: '自己收拾书包', points: 5 },
    { id: '40', name: '保持书桌整洁', points: 5 },
    { id: '41', name: '保持房间整洁', points: 5 },
    { id: '42', name: '坐姿端正', points: 3 },
    { id: '43', name: '做事不拖拉', points: 3 },
    { id: '44', name: '主动做家务', points: 3 },
    { id: '45', name: '吃饭不挑食', points: 2 },
    { id: '46', name: '主动洗漱', points: 2 },
    { id: '47', name: '整理书包、课桌', points: 1 },
    { id: '48', name: '认真吃饭、不挑食', points: 1 },
    { id: '49', name: '吃饭不超过20分钟', points: 1 },
    { id: '50', name: '按时睡觉、起床', points: 2 },
    { id: '51', name: '主动做家务', points: 2 },
    { id: '52', name: '照顾弟弟/妹妹', points: 1 },
    { id: '53', name: '每日运动30分钟', points: 2 },
    { id: '54', name: '自己洗袜子', points: 1 },
    { id: '55', name: '自己洗内裤', points: 1 },
    { id: '56', name: '扫地、拖地', points: 1 },
    { id: '57', name: '饭前端菜、摆碗筷', points: 1 },
    { id: '58', name: '饭后收拾桌子', points: 1 },
    { id: '59', name: '刷碗', points: 2 },
    { id: '60', name: '扔垃圾', points: 1 },
    { id: '61', name: '回家脱鞋放鞋架', points: 1 },
    { id: '62', name: '饭后拿餐具到厨房', points: 1 },
    { id: '63', name: '脱衣服后叠好放好', points: 1 },
    { id: '64', name: '睡前准备好第二天衣服', points: 1 },
    { id: '65', name: '独立睡觉', points: 2 },
    { id: '66', name: '早上起床5分钟内穿好衣服', points: 1 },
    { id: '67', name: '洗漱刷牙5分钟内搞定', points: 1 },
    { id: '68', name: '自己洗澡换吃饭勺子', points: 1 },
    { id: '69', name: '不挑食、20分钟用完餐', points: 1 },
    { id: '70', name: '按时起床、上学不迟到', points: 1 },
    { id: '71', name: '主动洗漱', points: 1 },
    { id: '72', name: '写完作业主动整理书桌书包', points: 1 },
    { id: '73', name: '认真吃饭、不挑食', points: 1 },
    { id: '74', name: '按时起床、按时吃饭', points: 1 },
    { id: '75', name: '一天不发脾气', points: 3 },
    { id: '76', name: '主动和认识的人打招呼', points: 2 },
    { id: '77', name: '公共场所不大声喧哗', points: 3 },
    { id: '78', name: '尊敬长辈、不顶嘴', points: 2 },
    { id: '79', name: '遇到难题想办法解决', points: 5 },
    { id: '80', name: '遇到问题不哭', points: 5 },
    { id: '81', name: '学习时注意力集中、不东张西望', points: 1 },
    { id: '82', name: '坐姿标准', points: 1 },
    { id: '83', name: '积极参加学校活动', points: 2 },
    { id: '84', name: '情绪稳定、不发脾气', points: 2 },
    { id: '85', name: '有礼貌、见到熟人打招呼', points: 1 },
    { id: '86', name: '公共场所不大声喧哗', points: 1 },
    { id: '87', name: '尊敬长辈', points: 5 },
    { id: '88', name: '遇到事情好好说、不哭闹', points: 3 },
    { id: '89', name: '老师表扬', points: 3 },
    { id: '90', name: '积极参加学校活动', points: 2 },
    { id: '91', name: '和同学友好相处', points: 2 },
    { id: '92', name: '爱护书本、文具不乱丢', points: 1 },
    { id: '93', name: '主动分享学校的事', points: 1 },
    { id: '94', name: '遇到困难不放弃、独立解决', points: 2 },
    { id: '95', name: '主动帮助同学', points: 1 },
    { id: '96', name: '遇到不会的题主动寻找老师同学帮助', points: 1 },
    { id: '97', name: '吵架', points: -10 },
    { id: '98', name: '打架', points: -10 },
    { id: '99', name: '说谎', points: -20 },
    { id: '100', name: '脏话', points: -10 },
    { id: '101', name: '顶嘴', points: -10 },
    { id: '102', name: '大喊', points: -5 },
    { id: '103', name: '哭鼻子', points: -5 },
    { id: '104', name: '不听使唤', points: -5 },
    { id: '105', name: '做事拖拉', points: -5 },
    { id: '106', name: '磨蹭拖延', points: -5 },
    { id: '107', name: '浪费食物', points: -5 },
    { id: '108', name: '不尊重长辈', points: -5 },
    { id: '109', name: '乱发脾气', points: -5 },
    { id: '110', name: '听算错一题', points: -1 },
    { id: '111', name: '口算错一题', points: -1 },
    { id: '112', name: '老师批评', points: -5 },
    { id: '113', name: '老师投诉作业没完成', points: -5 },
  ]

  const defaultRewards: Reward[] = [
    { id: 'r1', name: '平板时间15分钟', points: 20 },
    { id: 'r2', name: '买零食10元以内', points: 20 },
    { id: 'r3', name: '买任意零食20元以内', points: 40 },
    { id: 'r4', name: '打电动游戏一次', points: 50 },
    { id: 'r5', name: '买任意文具50元以内', points: 100 },
    { id: 'r6', name: '买任意礼物100元以内', points: 200 },
    { id: 'r7', name: '周六可自由支配半天', points: 400 },
    { id: 'r8', name: '满足一个心愿200元以内', points: 500 },
    { id: 'r9', name: '周日可自由支配一天', points: 800 },
  ]

  const [kids, setKids] = useState<Kid[]>(() =>
    loadFromStorage('kidcoins_kids', [])
  )
  const [currentKidId, setCurrentKidId] = useState<string | null>(() =>
    loadFromStorage('kidcoins_current_kid_id', null)
  )
  const [pointReasons, setPointReasons] = useState<PointReason[]>(() =>
    loadFromStorage('kidcoins_reasons', defaultPointReasons)
  )
  const [rewards, setRewards] = useState<Reward[]>(() =>
    loadFromStorage('kidcoins_rewards', defaultRewards)
  )
  const [records, setRecords] = useState<Record[]>(() =>
    loadFromStorage('kidcoins_records', [])
  )

  const [currentTab, setCurrentTab] = useState<Tab>('overview')
  const [modalOpen, setModalOpen] = useState<ModalType>(null)
  const [editingItem, setEditingItem] = useState<PointReason | Reward | null>(null)
  const [isEditingKid, setIsEditingKid] = useState(false)
  const [editKidName, setEditKidName] = useState('')
  const [editKidGender, setEditKidGender] = useState<Gender>('boy')
  
  const [kidName, setKidName] = useState('')
  const [kidGender, setKidGender] = useState<Gender>('boy')
  const [showAddKidForm, setShowAddKidForm] = useState(false)
  const [newReasonName, setNewReasonName] = useState('')
  const [newReasonPoints, setNewReasonPoints] = useState('')
  const [newRewardName, setNewRewardName] = useState('')
  const [newRewardPoints, setNewRewardPoints] = useState('')
  const [selectedReasonId, setSelectedReasonId] = useState('')
  const [selectedRewardId, setSelectedRewardId] = useState('')
  
  const [filterType, setFilterType] = useState<'all' | 'add' | 'redeem' | 'deduct'>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  
  // 头像上传状态
  const [avatarImage, setAvatarImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const rewardCsvInputRef = useRef<HTMLInputElement>(null)
  const recordsCsvInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem('kidcoins_theme', isDarkMode ? 'dark' : 'light')
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  useEffect(() => {
    localStorage.setItem('kidcoins_kids', JSON.stringify(kids))
  }, [kids])

  useEffect(() => {
    localStorage.setItem('kidcoins_current_kid_id', currentKidId || '')
  }, [currentKidId])

  useEffect(() => {
    if (currentKidId) {
      const exists = kids.find(k => k.id === currentKidId)
      if (!exists && kids.length > 0) {
        setCurrentKidId(kids[0].id)
      }
    }
  }, [kids])

  useEffect(() => {
    localStorage.setItem('kidcoins_reasons', JSON.stringify(pointReasons))
  }, [pointReasons])

  useEffect(() => {
    localStorage.setItem('kidcoins_rewards', JSON.stringify(rewards))
  }, [rewards])

  useEffect(() => {
    localStorage.setItem('kidcoins_records', JSON.stringify(records))
  }, [records])

  const currentKid = kids.find(k => k.id === currentKidId)

  const handleAddKid = (e: React.FormEvent) => {
    e.preventDefault()
    if (kidName.trim()) {
      const newKid: Kid = {
        id: Date.now().toString(),
        name: kidName.trim(),
        gender: kidGender,
        totalPoints: 0
      }
      setKids([...kids, newKid])
      setCurrentKidId(newKid.id)
      setKidName('')
      setShowAddKidForm(false)
    }
  }

  const handleAddReason = (e: React.FormEvent) => {
    e.preventDefault()
    if (newReasonName.trim() && newReasonPoints) {
      setPointReasons([...pointReasons, {
        id: Date.now().toString(),
        name: newReasonName.trim(),
        points: parseInt(newReasonPoints)
      }])
      setNewReasonName('')
      setNewReasonPoints('')
    }
  }

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n')
      
      const newReasons: PointReason[] = []
      
      lines.forEach((line, index) => {
        const trimmedLine = line.trim()
        if (!trimmedLine) return
        
        const parts = trimmedLine.split(',')
        if (parts.length >= 2) {
          const name = parts[0].trim()
          const points = parseInt(parts[1].trim())
          
          if (name && !isNaN(points)) {
            newReasons.push({
              id: Date.now().toString() + '_' + index,
              name,
              points
            })
          }
        }
      })
      
      if (newReasons.length > 0) {
        setPointReasons([...pointReasons, ...newReasons])
        alert(`成功导入 ${newReasons.length} 条积分理由`)
      } else {
        alert('导入失败：CSV格式不正确，请使用"名称,积分"格式')
      }
      
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  const handleRewardCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n')
      
      const newRewards: Reward[] = []
      
      lines.forEach((line, index) => {
        const trimmedLine = line.trim()
        if (!trimmedLine) return
        
        const parts = trimmedLine.split(',')
        if (parts.length >= 2) {
          const name = parts[0].trim()
          const points = parseInt(parts[1].trim())
          
          if (name && !isNaN(points)) {
            newRewards.push({
              id: Date.now().toString() + '_' + index,
              name,
              points
            })
          }
        }
      })
      
      if (newRewards.length > 0) {
        setRewards([...rewards, ...newRewards])
        alert(`成功导入 ${newRewards.length} 条奖励`)
      } else {
        alert('导入失败：CSV格式不正确，请使用"名称,积分"格式')
      }
      
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  const handleClearAllData = () => {
    if (confirm('确定要清空所有数据吗？这将删除所有孩子、积分理由、奖励和记录，恢复为默认数据。')) {
      localStorage.removeItem('kidcoins_kids')
      localStorage.removeItem('kidcoins_current_kid_id')
      localStorage.removeItem('kidcoins_reasons')
      localStorage.removeItem('kidcoins_rewards')
      localStorage.removeItem('kidcoins_records')
      setKids([])
      setCurrentKidId(null)
      setPointReasons(defaultPointReasons)
      setRewards(defaultRewards)
      setRecords([])
      alert('数据已清空，恢复默认设置')
    }
  }

  const handleExportRecords = () => {
    if (filteredRecords.length === 0) {
      alert('没有可导出的记录')
      return
    }

    const kidName = currentKid?.name || '全部'
    const headers = ['类型', '描述', '积分', '时间']
    const rows = filteredRecords.map(record => [
      record.type === 'add' ? '增加积分' : '兑换奖励',
      record.description,
      record.points.toString(),
      new Date(record.timestamp).toLocaleString('zh-CN')
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${kidName}_积分记录_${new Date().toLocaleDateString('zh-CN')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleRecordsCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentKid) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n')
      
      const importedRecords: Omit<Record, 'id' | 'timestamp'>[] = []
      
      lines.forEach((line) => {
        const trimmedLine = line.trim()
        if (!trimmedLine) return
        
        const parts = trimmedLine.split(',')
        if (parts.length >= 3) {
          const type = parts[0].trim()
          const description = parts[1].trim()
          const points = parseInt(parts[2].trim())
          
          if (['add', 'redeem'].includes(type) && description && !isNaN(points)) {
            importedRecords.push({
              type: type as 'add' | 'redeem',
              description,
              points,
              kidId: currentKid.id,
              reasonId: type === 'add' ? '1' : undefined,
              rewardId: type === 'redeem' ? 'r1' : undefined
            })
          }
        }
      })
      
      if (importedRecords.length > 0) {
        const newRecords: Record[] = importedRecords.map((r, i) => ({
          ...r,
          id: Date.now().toString() + '_' + i,
          timestamp: Date.now() + i
        }))
        setRecords([...newRecords, ...records])
        alert(`成功导入 ${newRecords.length} 条记录`)
      } else {
        alert('导入失败：CSV格式不正确，请使用"类型,描述,积分"格式')
      }
      
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  const handleEditReason = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingItem && 'points' in editingItem) {
      setPointReasons(pointReasons.map(r => 
        r.id === editingItem.id ? { ...r, name: newReasonName, points: parseInt(newReasonPoints) } : r
      ))
      closeModal()
    }
  }

  const handleDeleteReason = (id: string) => {
    if (confirm('确定要删除这个积分理由吗？')) {
      setPointReasons(pointReasons.filter(r => r.id !== id))
    }
  }

  const handleAddReward = (e: React.FormEvent) => {
    e.preventDefault()
    if (newRewardName.trim() && newRewardPoints) {
      setRewards([...rewards, {
        id: Date.now().toString(),
        name: newRewardName.trim(),
        points: parseInt(newRewardPoints)
      }])
      setNewRewardName('')
      setNewRewardPoints('')
    }
  }

  const handleEditReward = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingItem && 'points' in editingItem) {
      setRewards(rewards.map(r => 
        r.id === editingItem.id ? { ...r, name: newRewardName, points: parseInt(newRewardPoints) } : r
      ))
      closeModal()
    }
  }

  const handleDeleteReward = (id: string) => {
    if (confirm('确定要删除这个奖励吗？')) {
      setRewards(rewards.filter(r => r.id !== id))
    }
  }

  const startEditingKid = () => {
    if (currentKid) {
      setEditKidName(currentKid.name)
      setEditKidGender(currentKid.gender)
      setIsEditingKid(true)
    }
  }

  const saveKidInfo = () => {
    if (currentKid && editKidName.trim()) {
      setKids(kids.map(k => 
        k.id === currentKid.id 
          ? { ...k, name: editKidName.trim(), gender: editKidGender }
          : k
      ))
      setIsEditingKid(false)
    }
  }

  const cancelEditingKid = () => {
    setIsEditingKid(false)
    setEditKidName('')
    setEditKidGender('boy')
  }

  const handleDeleteKid = (id: string) => {
    if (confirm('确定要删除这个孩子吗？这将同时删除该孩子的所有积分记录。')) {
      const newKids = kids.filter(k => k.id !== id)
      setKids(newKids)
      setRecords(records.filter(r => r.kidId !== id))
      if (currentKidId === id) {
        setCurrentKidId(newKids.length > 0 ? newKids[0].id : null)
      }
    }
  }

  const handleAddPoints = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedReasonId && currentKid) {
      const reason = pointReasons.find(r => r.id === selectedReasonId)
      if (reason) {
        const newRecord: Record = {
          id: Date.now().toString(),
          type: 'add',
          reasonId: reason.id,
          points: reason.points,
          timestamp: Date.now(),
          description: reason.name,
          kidId: currentKid.id
        }
        setRecords([newRecord, ...records])
        setKids(kids.map(k => 
          k.id === currentKid.id 
            ? { ...k, totalPoints: k.totalPoints + reason.points }
            : k
        ))
        setSelectedReasonId('')
        closeModal()
      }
    }
  }

  const handleRedeemReward = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedRewardId && currentKid) {
      const reward = rewards.find(r => r.id === selectedRewardId)
      if (reward) {
        if (currentKid.totalPoints >= reward.points) {
          const newRecord: Record = {
            id: Date.now().toString(),
            type: 'redeem',
            rewardId: reward.id,
            points: -reward.points,
            timestamp: Date.now(),
            description: `兑换奖励: ${reward.name}`,
            kidId: currentKid.id
          }
          setRecords([newRecord, ...records])
          setKids(kids.map(k => 
            k.id === currentKid.id 
              ? { ...k, totalPoints: k.totalPoints - reward.points }
              : k
          ))
          setSelectedRewardId('')
          closeModal()
          alert(`成功兑换 ${reward.name}！`)
        } else {
          alert('积分不足！')
        }
      }
    }
  }

  const closeModal = () => {
    setModalOpen(null)
    setEditingItem(null)
    setNewReasonName('')
    setNewReasonPoints('')
    setNewRewardName('')
    setNewRewardPoints('')
    setSelectedReasonId('')
    setSelectedRewardId('')
    setAvatarImage(null)
  }

  const openEditModal = (type: 'reason' | 'reward', item: PointReason | Reward) => {
    setEditingItem(item)
    if (type === 'reason') {
      setNewReasonName(item.name)
      setNewReasonPoints(item.points.toString())
      setModalOpen('editReason')
    } else {
      setNewRewardName(item.name)
      setNewRewardPoints(item.points.toString())
      setModalOpen('editReward')
    }
  }
  
  // 头像上传处理
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setAvatarImage(event.target?.result as string)
        setModalOpen('editAvatar')
      }
      reader.readAsDataURL(file)
    }
  }
  
  const handleAvatarCropComplete = (croppedImage: string) => {
    if (currentKid) {
      setKids(kids.map(k => 
        k.id === currentKid.id 
          ? { ...k, avatar: croppedImage }
          : k
      ))
      closeModal()
    }
  }
  
  const handleClearAvatar = () => {
    if (currentKid) {
      setKids(kids.map(k => 
        k.id === currentKid.id 
          ? { ...k, avatar: undefined }
          : k
      ))
    }
  }

  const filteredRecords = records.filter(record => {
    if (!currentKid || record.kidId !== currentKid.id) return false
    if (filterType === 'add') {
      if (record.type !== 'add' || record.points < 0) return false
    } else if (filterType === 'deduct') {
      if (record.type !== 'add' || record.points >= 0) return false
    } else if (filterType !== 'all' && record.type !== filterType) {
      return false
    }
    
    const recordDate = new Date(record.timestamp)
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom)
      if (recordDate < fromDate) return false
    }
    if (filterDateTo) {
      const toDate = new Date(filterDateTo)
      toDate.setHours(23, 59, 59)
      if (recordDate > toDate) return false
    }
    
    return true
  })

  const totalPages = Math.ceil(filteredRecords.length / RECORDS_PER_PAGE)
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * RECORDS_PER_PAGE,
    currentPage * RECORDS_PER_PAGE
  )

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const recentRecords = records
    .filter(r => !currentKid || r.kidId === currentKid.id)
    .slice(0, 5)

  const stats = {
    totalAdd: records
      .filter(r => (!currentKid || r.kidId === currentKid.id) && r.type === 'add')
      .reduce((sum, r) => sum + r.points, 0),
    totalRedeem: Math.abs(records
      .filter(r => (!currentKid || r.kidId === currentKid.id) && r.type === 'redeem')
      .reduce((sum, r) => sum + r.points, 0)),
    count: records.filter(r => !currentKid || r.kidId === currentKid.id).length
  }

  // 获取头像显示
  const getAvatarDisplay = () => {
    if (currentKid?.avatar) {
      return <img src={currentKid.avatar} alt="avatar" className="avatar-img" />
    }
    return currentKid?.gender === 'boy' ? '👦' : '👧'
  }

  const renderTabContent = () => {
    switch (currentTab) {
      case 'overview':
        return (
          <div className="tab-content">
            {!currentKid || showAddKidForm ? (
              <section className="section card">
                <h2>👋 欢迎使用 KidCoins</h2>
                <p className="section-desc">请先添加一个孩子开始使用</p>
                <form onSubmit={handleAddKid} className="form-stack">
                  <input
                    type="text"
                    value={kidName}
                    onChange={(e) => setKidName(e.target.value)}
                    placeholder="请输入孩子姓名"
                    className="input"
                  />
                  <div className="gender-selector">
                    <button 
                      type="button"
                      className={`gender-btn ${kidGender === 'boy' ? 'active' : ''}`}
                      onClick={() => setKidGender('boy')}
                    >
                      👦 男孩
                    </button>
                    <button 
                      type="button"
                      className={`gender-btn ${kidGender === 'girl' ? 'active' : ''}`}
                      onClick={() => setKidGender('girl')}
                    >
                      👧 女孩
                    </button>
                  </div>
                  <div className="form-row">
                    <button type="submit" className="btn btn-primary btn-large">
                      添加孩子
                    </button>
                    {kids.length > 0 && (
                      <button 
                        type="button" 
                        className="btn btn-large"
                        onClick={() => {
                          setShowAddKidForm(false)
                          setCurrentKidId(kids[0].id)
                        }}
                      >
                        取消
                      </button>
                    )}
                  </div>
                </form>
              </section>
            ) : (
              <>
                <section className="section hero-card">
                  <div className="hero-content">
                    {isEditingKid ? (
                      <>
                        <div className="avatar-edit">
                          <div className="avatar-preview">{editKidGender === 'boy' ? '👦' : '👧'}</div>
                          <div className="gender-edit-selector">
                            <button
                              type="button"
                              className={`gender-edit-btn ${editKidGender === 'boy' ? 'active' : ''}`}
                              onClick={() => setEditKidGender('boy')}
                              title="男孩"
                            >
                              👦
                            </button>
                            <button
                              type="button"
                              className={`gender-edit-btn ${editKidGender === 'girl' ? 'active' : ''}`}
                              onClick={() => setEditKidGender('girl')}
                              title="女孩"
                            >
                              👧
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={editKidName}
                          onChange={(e) => setEditKidName(e.target.value)}
                          className="input edit-name-input"
                          placeholder="孩子姓名"
                          autoFocus
                        />
                        <div className="hero-actions hero-actions-small">
                          <button className="btn btn-success btn-small" onClick={saveKidInfo}>
                            ✓ 保存
                          </button>
                          <button className="btn btn-small" onClick={cancelEditingKid}>
                            ✕ 取消
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="avatar-wrapper" onClick={() => setModalOpen('editAvatar')}>
                          <div className="avatar">{getAvatarDisplay()}</div>
                          <div className="avatar-edit-hint">✏️</div>
                        </div>
                        <h2 className="hero-title" onClick={startEditingKid}>
                          {currentKid!.name}
                          <span className="edit-icon">✏️</span>
                        </h2>
                        <div className="hero-points">
                          <span className="points-label">当前积分</span>
                          <span className="points-value">{currentKid!.totalPoints}</span>
                        </div>
                        <div className="hero-actions">
                          <button 
                            className="btn btn-success"
                            onClick={() => setModalOpen('addPoints')}
                          >
                            🚀 增加积分
                          </button>
                          <button 
                            className="btn btn-warning"
                            onClick={() => setModalOpen('redeem')}
                          >
                            🛒 兑换奖励
                          </button>
                        </div>
                        {kids.length > 1 && (
                          <button 
                            className="btn btn-icon btn-danger btn-delete-kid"
                            onClick={() => handleDeleteKid(currentKid!.id)}
                            title="删除孩子"
                          >
                            🗑️
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </section>

                <section className="section">
                  <h3>📊 统计概览</h3>
                  <div className="stats-grid">
                    <div className="stat-card stat-add">
                      <div className="stat-icon">🚀</div>
                      <div className="stat-value">+{stats.totalAdd}</div>
                      <div className="stat-label">累计获得</div>
                    </div>
                    <div className="stat-card stat-redeem">
                      <div className="stat-icon">🛒</div>
                      <div className="stat-value">-{stats.totalRedeem}</div>
                      <div className="stat-label">累计兑换</div>
                    </div>
                    <div className="stat-card stat-total">
                      <div className="stat-icon">📋</div>
                      <div className="stat-value">{stats.count}</div>
                      <div className="stat-label">记录总数</div>
                    </div>
                  </div>
                </section>

                <section className="section">
                  <div className="section-header">
                    <h3>🕐 最近记录</h3>
                    <button className="btn btn-text" onClick={() => setCurrentTab('records')}>
                      查看全部 →
                    </button>
                  </div>
                  {recentRecords.length > 0 ? (
                    <div className="recent-list">
                      {recentRecords.map(record => (
                        <div key={record.id} className={`recent-item ${record.type} ${record.type === 'add' && record.points < 0 ? 'add-deduct' : ''}`}>
                          <span className="recent-icon">{record.type === 'add' ? (record.points < 0 ? '📉' : '🚀') : '🛒'}</span>
                          <span className="recent-text">{record.description}</span>
                          <span className={`recent-points ${record.type} ${record.type === 'add' && record.points < 0 ? 'text-warning' : ''}`}>
                            {record.points > 0 ? '+' : ''}{record.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-text">暂无记录</p>
                  )}
                </section>
              </>
            )}
          </div>
        )

      case 'records':
        return (
          <div className="tab-content">
            <section className="section">
              <h2>📊 积分记录</h2>
              <p className="section-desc">查看所有积分变动记录</p>
              
              <div className="filters-bar">
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value as any)
                    setCurrentPage(1)
                  }}
                  className="select"
                >
                  <option value="all">所有类型</option>
                  <option value="add">增加积分</option>
                  <option value="deduct">扣除积分</option>
                  <option value="redeem">兑换奖励</option>
                </select>
                
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => {
                    setFilterDateFrom(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="input"
                />
                
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => {
                    setFilterDateTo(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="input"
                />
                
                <button 
                  onClick={() => {
                    setFilterType('all')
                    setFilterDateFrom('')
                    setFilterDateTo('')
                    setCurrentPage(1)
                  }}
                  className="btn btn-small"
                >
                  清除
                </button>
              </div>

              <div className="csv-import-section">
                <button 
                  onClick={handleExportRecords}
                  className="btn btn-secondary"
                  disabled={filteredRecords.length === 0}
                >
                  📤 导出CSV
                </button>
                
                <button 
                  onClick={() => recordsCsvInputRef.current?.click()}
                  className="btn btn-secondary"
                >
                  📥 导入CSV
                </button>
                <input
                  ref={recordsCsvInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleRecordsCSVImport}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="records-timeline">
                {paginatedRecords.length > 0 ? (
                  paginatedRecords.map((record) => (
                    <div key={record.id} className={`timeline-item ${record.type}`}>
                      <div className="timeline-marker">
                        <span className="timeline-icon">{record.type === 'add' ? (record.points < 0 ? '📉' : '🚀') : '🛒'}</span>
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <span className="timeline-title">{record.description}</span>
                          <span className={`timeline-points ${record.type} ${record.type === 'add' && record.points < 0 ? 'text-warning' : ''}`}>
                            {record.points > 0 ? '+' : ''}{record.points}
                          </span>
                        </div>
                        <div className="timeline-time">{formatDate(record.timestamp)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-card">
                    <div className="empty-icon">📭</div>
                    <p>没有符合条件的记录</p>
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-small"
                  >
                    ← 上一页
                  </button>
                  <span className="page-info">
                    第 {currentPage} / {totalPages} 页
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn-small"
                  >
                    下一页 →
                  </button>
                </div>
              )}
            </section>
          </div>
        )

      case 'settings':
        return (
          <div className="tab-content">
            <section className="section">
              <h2>⚙️ 设置</h2>
              <p className="section-desc">请选择要配置的选项</p>
              
              <div className="settings-grid">
                <div 
                  className="settings-card"
                  onClick={() => setCurrentTab('reasons')}
                >
                  <div className="settings-icon">📋</div>
                  <div className="settings-title">积分理由</div>
                  <div className="settings-desc">设置可以获得积分的理由和对应分值</div>
                </div>
                <div 
                  className="settings-card"
                  onClick={() => setCurrentTab('rewards')}
                >
                  <div className="settings-icon">🎁</div>
                  <div className="settings-title">奖励设置</div>
                  <div className="settings-desc">设置可以兑换的奖励和所需积分</div>
                </div>
              </div>
            </section>
          </div>
        )

      case 'reasons':
        return (
          <div className="tab-content">
            <section className="section">
              <div className="section-header">
                <h2>📋 积分理由</h2>
                <button className="btn btn-text" onClick={() => setCurrentTab('settings')}>
                  ← 返回设置
                </button>
              </div>
              <p className="section-desc">设置可以获得积分的理由和对应分值</p>
              
              <form onSubmit={handleAddReason} className="form-card">
                <div className="form-row">
                  <input
                    type="text"
                    value={newReasonName}
                    onChange={(e) => setNewReasonName(e.target.value)}
                    placeholder="理由名称（如：认真完成作业）"
                    className="input"
                  />
                  <input
                    type="number"
                    value={newReasonPoints}
                    onChange={(e) => setNewReasonPoints(e.target.value)}
                    placeholder="积分"
                    className="input input-narrow"
                    min="1"
                  />
                  <button type="submit" className="btn btn-primary">添加</button>
                </div>
              </form>

              <div className="csv-import-section">
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                  style={{ display: 'none' }}
                />
                <button 
                  className="btn btn-secondary"
                  onClick={() => csvInputRef.current?.click()}
                >
                  📁 从CSV导入
                </button>
                <span className="csv-hint">CSV格式：名称,积分（每行一条）</span>
              </div>

              <div className="card-grid">
                {pointReasons.length > 0 ? (
                  pointReasons.map(reason => (
                    <div key={reason.id} className="item-card">
                      <div className="item-info">
                        <span className="item-name">{reason.name}</span>
                        <span className={`item-points ${reason.points >= 0 ? 'add' : 'redeem'}`}>{reason.points >= 0 ? '+' : ''}{reason.points} 分</span>
                      </div>
                      <div className="item-actions">
                        <button 
                          onClick={() => openEditModal('reason', reason)}
                          className="btn btn-icon"
                          title="编辑"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteReason(reason.id)}
                          className="btn btn-icon btn-danger"
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-card">
                    <div className="empty-icon">📝</div>
                    <p>还没有积分理由</p>
                    <p className="empty-sub">添加一个开始使用</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )

      case 'rewards':
        return (
          <div className="tab-content">
            <section className="section">
              <div className="section-header">
                <h2>🎁 奖励设置</h2>
                <button className="btn btn-text" onClick={() => setCurrentTab('settings')}>
                  ← 返回设置
                </button>
              </div>
              <p className="section-desc">设置可以兑换的奖励和所需积分</p>
              
              <form onSubmit={handleAddReward} className="form-card">
                <div className="form-row">
                  <input
                    type="text"
                    value={newRewardName}
                    onChange={(e) => setNewRewardName(e.target.value)}
                    placeholder="奖励名称（如：看电视30分钟）"
                    className="input"
                  />
                  <input
                    type="number"
                    value={newRewardPoints}
                    onChange={(e) => setNewRewardPoints(e.target.value)}
                    placeholder="积分"
                    className="input input-narrow"
                    min="1"
                  />
                  <button type="submit" className="btn btn-primary">添加</button>
                </div>
              </form>

              <div className="csv-import-section">
                <input
                  ref={rewardCsvInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleRewardCSVImport}
                  style={{ display: 'none' }}
                />
                <button 
                  className="btn btn-secondary"
                  onClick={() => rewardCsvInputRef.current?.click()}
                >
                  📁 从CSV导入
                </button>
                <span className="csv-hint">CSV格式：名称,积分（每行一条）</span>
              </div>

              <div className="card-grid">
                {rewards.length > 0 ? (
                  rewards.map(reward => (
                    <div key={reward.id} className="item-card">
                      <div className="item-info">
                        <span className="item-name">{reward.name}</span>
                        <span className="item-points redeem">-{reward.points} 分</span>
                      </div>
                      <div className="item-actions">
                        <button 
                          onClick={() => openEditModal('reward', reward)}
                          className="btn btn-icon"
                          title="编辑"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteReward(reward.id)}
                          className="btn btn-icon btn-danger"
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-card">
                    <div className="empty-icon">🎁</div>
                    <p>还没有奖励设置</p>
                    <p className="empty-sub">添加一个开始使用</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )
    }
  }

  return (
    <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>
      <aside className="app-sidebar">
        <div className="sidebar-top">
          <header className="app-header">
            <div className="header-content">
              <h1><img src="/kidcoins.png" alt="KidCoins" style={{width: '24px', height: '24px', verticalAlign: 'middle'}} /> KidCoins</h1>
              <div className="header-actions">
                {currentKid && (
                  <div className="header-points">
                    <span className="points-coin">🪙</span>
                    <span className="points-number">{currentKid.totalPoints}</span>
                  </div>
                )}
                <button 
                  className="theme-toggle"
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  title={isDarkMode ? '切换到白天模式' : '切换到暗夜模式'}
                >
                  {isDarkMode ? '☀️' : '🌙'}
                </button>
                {import.meta.env.DEV && (
                  <button 
                    className="theme-toggle"
                    onClick={handleClearAllData}
                    title="清空所有数据"
                  >
                    🔄
                  </button>
                )}
              </div>
            </div>
            
            {kids.length > 0 && (
              <div className="kid-selector">
                {kids.map(k => (
                  <div
                    key={k.id}
                    className={`kid-chip ${currentKidId === k.id ? 'selected' : ''}`}
                    onClick={() => setCurrentKidId(k.id)}
                  >
                    <div className="kid-chip-avatar">
                      {k.avatar ? (
                        <img src={k.avatar} alt={k.name} />
                      ) : (
                        k.gender === 'boy' ? '👦' : '👧'
                      )}
                    </div>
                    <div className="kid-chip-info">
                      <span className="kid-chip-name">{k.name}</span>
                      <span className="kid-chip-points">{k.totalPoints}分</span>
                    </div>
                    <div className="kid-chip-check">✓</div>
                  </div>
                ))}
                <button 
                  className="btn-add-kid"
                  onClick={() => {
                    setKidName('')
                    setKidGender('boy')
                    setShowAddKidForm(true)
                    setCurrentTab('overview')
                  }}
                  title="添加新孩子"
                >
                  +
                </button>
              </div>
            )}
          </header>
        </div>
        
        {currentKid && (
          <nav className="tab-nav">
            <button 
              className={`tab-btn ${currentTab === 'overview' ? 'active' : ''}`}
              onClick={() => setCurrentTab('overview')}
            >
              🏠 总览
            </button>
            <button 
              className={`tab-btn ${currentTab === 'records' ? 'active' : ''}`}
              onClick={() => setCurrentTab('records')}
            >
              📊 积分记录
            </button>
            <button 
              className={`tab-btn ${currentTab === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentTab('settings')}
            >
              ⚙️ 设置
            </button>
          </nav>
        )}
      </aside>

      <main className="app-main">
        {renderTabContent()}
      </main>

      {/* 悬浮按钮（只在积分记录页显示） */}
      {currentKid && currentTab === 'records' && (
        <div className="fab-container">
          <button 
            className="fab fab-primary"
            onClick={() => setModalOpen('addPoints')}
            title="增加积分"
          >
            🚀
          </button>
          <button 
            className="fab fab-secondary"
            onClick={() => setModalOpen('redeem')}
            title="兑换奖励"
          >
            🛒
          </button>
        </div>
      )}

      {/* Modal 弹窗 */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {modalOpen === 'addPoints' && '🚀 增加积分'}
                {modalOpen === 'redeem' && '🛒 兑换奖励'}
                {modalOpen === 'editReason' && '✏️ 编辑积分理由'}
                {modalOpen === 'editReward' && '✏️ 编辑奖励'}
                {modalOpen === 'editAvatar' && '📷 编辑头像'}
              </h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            
            <div className="modal-body">
              {modalOpen === 'addPoints' && (
                <form onSubmit={handleAddPoints} className="form-stack">
                  <div className="form-group">
                    <label>选择积分理由：</label>
                    <SearchableSelect
                      options={pointReasons.map(r => ({ id: r.id, label: r.name, points: r.points }))}
                      value={selectedReasonId}
                      onChange={setSelectedReasonId}
                      placeholder="搜索积分理由..."
                      emptyText="无匹配的积分理由"
                    />
                  </div>
                  {selectedReasonId && (
                    <div className="preview-points">
                      将获得 <strong className={((pointReasons.find(r => r.id === selectedReasonId)?.points ?? 0) < 0 ? 'text-warning' : '')}>{pointReasons.find(r => r.id === selectedReasonId)?.points}</strong> 积分
                    </div>
                  )}
                  <button 
                    type="submit" 
                    className="btn btn-success btn-large"
                    disabled={!selectedReasonId}
                  >
                    确认增加
                  </button>
                </form>
              )}

              {modalOpen === 'redeem' && (
                <form onSubmit={handleRedeemReward} className="form-stack">
                  <div className="form-group">
                    <label>选择要兑换的奖励：</label>
                    <SearchableSelect
                      options={rewards.map(r => ({ id: r.id, label: r.name, points: r.points }))}
                      value={selectedRewardId}
                      onChange={setSelectedRewardId}
                      placeholder="搜索奖励..."
                      emptyText="无匹配的奖励"
                    />
                  </div>
                  {selectedRewardId && (
                    <div className="preview-points">
                      需要扣除 <strong>{rewards.find(r => r.id === selectedRewardId)?.points}</strong> 积分
                      <br />
                      <small>当前余额: {currentKid?.totalPoints} 积分</small>
                    </div>
                  )}
                  <button 
                    type="submit" 
                    className="btn btn-warning btn-large"
                    disabled={!selectedRewardId || !currentKid || currentKid.totalPoints < (rewards.find(r => r.id === selectedRewardId)?.points ?? 0)}
                  >
                    确认兑换
                  </button>
                </form>
              )}

              {modalOpen === 'editReason' && (
                <form onSubmit={handleEditReason} className="form-stack">
                  <div className="form-group">
                    <label>理由名称：</label>
                    <input
                      type="text"
                      value={newReasonName}
                      onChange={(e) => setNewReasonName(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label>积分：</label>
                    <input
                      type="number"
                      value={newReasonPoints}
                      onChange={(e) => setNewReasonPoints(e.target.value)}
                      className="input"
                      min="1"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-large">
                    保存修改
                  </button>
                </form>
              )}

              {modalOpen === 'editReward' && (
                <form onSubmit={handleEditReward} className="form-stack">
                  <div className="form-group">
                    <label>奖励名称：</label>
                    <input
                      type="text"
                      value={newRewardName}
                      onChange={(e) => setNewRewardName(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label>所需积分：</label>
                    <input
                      type="number"
                      value={newRewardPoints}
                      onChange={(e) => setNewRewardPoints(e.target.value)}
                      className="input"
                      min="1"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-large">
                    保存修改
                  </button>
                </form>
              )}
              
              {modalOpen === 'editAvatar' && (
                <div className="form-stack">
                  {!avatarImage ? (
                    <>
                      <div className="avatar-options">
                        <div className="avatar-option-group">
                          <p className="option-label">使用Emoji头像</p>
                          <div className="avatar-emoji-selector">
                            <button 
                              className={`avatar-emoji-btn ${currentKid?.gender === 'boy' && !currentKid?.avatar ? 'active' : ''}`}
                              onClick={() => {
                                if (currentKid) {
                                  setKids(kids.map(k => 
                                    k.id === currentKid.id 
                                      ? { ...k, gender: 'boy', avatar: undefined }
                                      : k
                                  ))
                                  closeModal()
                                }
                              }}
                            >
                              👦
                            </button>
                            <button 
                              className={`avatar-emoji-btn ${currentKid?.gender === 'girl' && !currentKid?.avatar ? 'active' : ''}`}
                              onClick={() => {
                                if (currentKid) {
                                  setKids(kids.map(k => 
                                    k.id === currentKid.id 
                                      ? { ...k, gender: 'girl', avatar: undefined }
                                      : k
                                  ))
                                  closeModal()
                                }
                              }}
                            >
                              👧
                            </button>
                          </div>
                        </div>
                        
                        <div className="avatar-divider">
                          <span>或</span>
                        </div>
                        
                        <div className="avatar-option-group">
                          <p className="option-label">上传图片</p>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                          />
                          <button 
                            className="btn btn-primary"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            📷 选择图片
                          </button>
                        </div>
                      </div>
                      
                      {currentKid?.avatar && (
                        <>
                          <div className="avatar-divider">
                            <span>当前头像</span>
                          </div>
                          <div className="current-avatar-preview">
                            <img src={currentKid.avatar} alt="当前头像" />
                          </div>
                          <button 
                            className="btn btn-danger"
                            onClick={handleClearAvatar}
                          >
                            🗑️ 删除头像
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <AvatarCropper
                      image={avatarImage}
                      onCropComplete={handleAvatarCropComplete}
                      onCancel={() => setAvatarImage(null)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
