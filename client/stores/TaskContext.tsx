/**
 * TaskContext.tsx - 任务状态管理（相当于 Pinia Store 的 React Context 实现）
 *
 * 职责：
 * - 管理任务的增删改查（CRUD）
 * - 任务状态流转：待办 → 已完成 / 已取消
 * - 任务的本地持久化（AsyncStorage）—— 立即写入，不依赖 useEffect 延迟
 * - 重复任务的下一次时间计算
 *
 * ⚠️ 关键设计：所有状态变更操作都立即持久化到 AsyncStorage，
 *    避免 useEffect 延迟写入导致 app 关闭时数据丢失（Issue #3 修复）
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// 类型定义
// ============================================================

/** 重复类型 */
export type RepeatType = 'none' | 'daily' | 'weekly' | 'custom';

/** 任务状态 */
export type TaskStatus = 'pending' | 'completed' | 'cancelled';

/** 单个任务 */
export interface Task {
  id: string;                    // 唯一 ID
  title: string;                 // 任务标题
  description?: string;          // 任务描述（可选）
  time: string;                  // 提醒时间，格式 "HH:mm"
  repeat: RepeatType;            // 重复类型
  status: TaskStatus;            // 当前状态
  confidence: number;            // AI 解析置信度 0-1
  createdAt: string;             // 创建时间 ISO 字符串
  completedAt?: string;          // 完成时间 ISO 字符串
  nextRemindDate?: string;       // 下一次提醒日期 ISO 字符串
}

// ============================================================
// State & Action 类型
// ============================================================

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
}

type TaskAction =
  | { type: 'SET_TASKS'; payload: Task[] }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: { id: string; updates: Partial<Task> } }
  | { type: 'REMOVE_TASK'; payload: string }
  | { type: 'TOGGLE_COMPLETE'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean };

// ============================================================
// Reducer
// ============================================================

const STORAGE_KEY = '@memory_note_tasks';

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'SET_TASKS':
      return { ...state, tasks: action.payload };

    case 'ADD_TASK':
      return { ...state, tasks: [action.payload, ...state.tasks] };

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload.updates } : t
        ),
      };

    case 'REMOVE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.payload),
      };

    case 'TOGGLE_COMPLETE': {
      const now = new Date().toISOString();
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.payload) return t;

          if (t.status === 'completed') {
            // 取消完成 → 恢复为待办
            return { ...t, status: 'pending' as TaskStatus, completedAt: undefined };
          }

          // 标记为完成
          const updated = { ...t, status: 'completed' as TaskStatus, completedAt: now };

          // 如果是重复任务，计算下次时间并重置状态
          if (t.repeat !== 'none') {
            updated.status = 'pending'; // 重复任务完成后立即恢复为待办
            updated.nextRemindDate = calculateNextDate(t.repeat, t.time);
          }

          return updated;
        }),
      };
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    default:
      return state;
  }
}

// ============================================================
// 工具函数
// ============================================================

/** 生成唯一 ID */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** 计算重复任务的下一次执行日期 */
function calculateNextDate(repeat: RepeatType, time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date(now);

  next.setHours(hours, minutes, 0, 0);

  if (repeat === 'daily') {
    // 如果今天的提醒时间已过，推后到明天
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  } else if (repeat === 'weekly') {
    // 每周提醒，推后 7 天
    while (next <= now) {
      next.setDate(next.getDate() + 7);
    }
  }

  return next.toISOString();
}

// ============================================================
// Context
// ============================================================

interface TaskContextType {
  state: TaskState;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'status'>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  getTodayTasks: () => Task[];
  getPendingTasks: () => Task[];
  getTaskById: (id: string) => Task | undefined;
  /** 获取即将到期的任务（1小时内） */
  getUpcomingTasks: () => Task[];
}

const TaskContext = createContext<TaskContextType | null>(null);

// ============================================================
// Provider
// ============================================================

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, {
    tasks: [],
    isLoading: true,
  });

  // ── Ref 始终跟踪最新 tasks（用于即时持久化，不受渲染周期影响） ──
  const tasksRef = useRef<Task[]>([]);
  useEffect(() => {
    tasksRef.current = state.tasks;
  }, [state.tasks]);

  // ── 持久化函数（立即写入 AsyncStorage） ──
  const persistImmediately = useCallback(async (tasks: Task[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error('保存任务失败:', error);
    }
  }, []);

  // ── 加载时从 AsyncStorage 恢复 ──
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const tasks: Task[] = JSON.parse(saved);
          // 先填充 ref（确保后面 addTask/removeTask 有数据）
          tasksRef.current = tasks;
          dispatch({ type: 'SET_TASKS', payload: tasks });
        }
      } catch (error) {
        console.error('加载任务失败:', error);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, []);

  // ── 后备持久化（覆盖 useEffect 方式，兜底保护） ──
  // 即使 action handler 的即时保存没执行，这里也会在下一次渲染时保存
  const prevTasksRef = useRef<Task[]>([]);
  useEffect(() => {
    if (!state.isLoading && state.tasks !== prevTasksRef.current) {
      prevTasksRef.current = state.tasks;
      persistImmediately(state.tasks);
    }
  }, [state.tasks, state.isLoading, persistImmediately]);

  // ============================================================
  // Action Methods（立即持久化 + dispatch）
  // ============================================================

  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt' | 'status'>): Promise<Task> => {
    const now = new Date().toISOString();
    const task: Task = {
      ...taskData,
      id: generateId(),
      createdAt: now,
      status: 'pending',
    };

    // 先持久化（确保数据安全，即使 app 立刻被关闭）
    const newTasks = [...tasksRef.current, task];
    tasksRef.current = newTasks;
    await persistImmediately(newTasks);

    // 再 dispatch 更新 UI
    dispatch({ type: 'ADD_TASK', payload: task });
    return task;
  }, [persistImmediately]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    dispatch({ type: 'UPDATE_TASK', payload: { id, updates } });
    // 即时持久化（用 ref 获取最新状态）
    const updatedTasks = tasksRef.current.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    tasksRef.current = updatedTasks;
    await persistImmediately(updatedTasks);
  }, [persistImmediately]);

  const removeTask = useCallback(async (id: string) => {
    dispatch({ type: 'REMOVE_TASK', payload: id });
    // 即时持久化
    const filteredTasks = tasksRef.current.filter((t) => t.id !== id);
    tasksRef.current = filteredTasks;
    await persistImmediately(filteredTasks);
  }, [persistImmediately]);

  const toggleComplete = useCallback(async (id: string) => {
    dispatch({ type: 'TOGGLE_COMPLETE', payload: id });
    // 即时持久化（计算新的状态）
    const now = new Date().toISOString();
    const updatedTasks = tasksRef.current.map((t) => {
      if (t.id !== id) return t;
      if (t.status === 'completed') {
        return { ...t, status: 'pending' as TaskStatus, completedAt: undefined };
      }
      const updated = { ...t, status: 'completed' as TaskStatus, completedAt: now };
      if (t.repeat !== 'none') {
        updated.status = 'pending';
        updated.nextRemindDate = calculateNextDate(t.repeat, t.time);
      }
      return updated;
    });
    tasksRef.current = updatedTasks;
    await persistImmediately(updatedTasks);
  }, [persistImmediately]);

  // ============================================================
  // 查询方法
  // ============================================================

  /** 获取今天的待办任务 */
  const getTodayTasks = useCallback((): Task[] => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    return state.tasks.filter((t) => {
      if (t.status === 'cancelled') return false;

      // 已完成的任务如果是在今天完成的也显示
      if (t.status === 'completed') {
        return t.completedAt?.startsWith(todayStr) ?? false;
      }

      // 待办任务：今天创建或今天有提醒
      const createdToday = t.createdAt.startsWith(todayStr);
      const remindToday = t.nextRemindDate?.startsWith(todayStr) ?? false;

      // 如果设置了提醒时间，检查是否在今天的提醒周期内
      if (t.repeat === 'daily') return true; // 每日任务每天都显示
      if (t.repeat === 'weekly') {
        const createdDay = new Date(t.createdAt).getDay();
        return createdDay === today.getDay();
      }

      return createdToday || remindToday;
    }).sort((a, b) => {
      // 按时间排序
      return a.time.localeCompare(b.time);
    });
  }, [state.tasks]);

  /** 获取所有待办任务 */
  const getPendingTasks = useCallback((): Task[] => {
    return state.tasks.filter((t) => t.status === 'pending');
  }, [state.tasks]);

  /** 根据 ID 获取任务 */
  const getTaskById = useCallback((id: string): Task | undefined => {
    return state.tasks.find((t) => t.id === id);
  }, [state.tasks]);

  /** 获取即将到期的任务 */
  const getUpcomingTasks = useCallback((): Task[] => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    return state.tasks.filter((t) => {
      if (t.status !== 'pending') return false;

      // 检查是否有当天的提醒
      const remindDate = t.nextRemindDate ? new Date(t.nextRemindDate) : null;
      if (!remindDate) return false;

      return remindDate >= now && remindDate <= oneHourLater;
    });
  }, [state.tasks]);

  return (
    <TaskContext.Provider
      value={{
        state,
        addTask,
        updateTask,
        removeTask,
        toggleComplete,
        getTodayTasks,
        getPendingTasks,
        getTaskById,
        getUpcomingTasks,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useTaskStore() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskStore 必须在 TaskProvider 内使用');
  }
  return context;
}