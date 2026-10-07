// Typed facade over the web app's seed data (shared via metro.config.js watchFolders).
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore - plain JS module outside this package
import * as seed from '../../frontend/src/shared/data.js';

export type User = { id: string; name: string; role: string; title?: string; ini: string };
export type Project = {
  id: string; code: string; name: string; kind: string; city: string; phase: number;
  clientId: string | null; teamIds: string[]; budget: number; actual: number; handover: string;
  milestones: { id: string; name: string; date: string; done: boolean; clientVisible: boolean }[];
};
export type Task = {
  id: string; projectId: string; title: string; owner: string; due: string; status: string;
  priority?: string; critical?: boolean; description?: string;
};
export type Thread = { id: string; projectId: string; name: string; kind: string; memberIds: string[] };
export type Message = { id: string; threadId: string; by: string; text?: string; at?: string };

export const USERS: User[] = seed.USERS;
export const PROJECTS: Project[] = seed.PROJECTS;
export const TASKS: Task[] = seed.TASKS;
export const THREADS: Thread[] = seed.THREADS;
export const MESSAGES: Message[] = seed.MESSAGES;
export const PHASES: string[] = seed.PHASES;

export const userById = (id: string) => USERS.find((u) => u.id === id);
export const inr = (n: number) => '₹' + Number(n).toLocaleString('en-IN');
