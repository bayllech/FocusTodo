use crate::storage::FileStore;

pub struct AppState {
  store: FileStore,
}

impl AppState {
  pub fn new(store: FileStore) -> Self {
    Self { store }
  }

  pub fn store(&self) -> &FileStore {
    &self.store
  }
}
