use std::io;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
  #[error("无法解析应用数据目录")]
  ResolveDir,
  #[error("IO错误: {0}")]
  Io(#[from] io::Error),
  #[error("JSON 编解码失败: {0}")]
  Json(#[from] serde_json::Error),
  #[error("数据不存在: {0}")]
  NotFound(&'static str),
  #[error("数据校验失败: {0}")]
  Validation(String),
}

impl StorageError {
  pub fn validation<T: Into<String>>(msg: T) -> Self {
    StorageError::Validation(msg.into())
  }
}
