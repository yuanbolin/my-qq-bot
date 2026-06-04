import petPetGif from '@someaspy/pet-pet-gif'

/** 根据头像 URL 生成摸头杀 GIF（与 toolwa petpet 同类算法） */
export async function generatePetpetGif(avatarUrl: string): Promise<Buffer> {
  return petPetGif(avatarUrl, {
    resolution: 128,
    delay: 20,
    backgroundColor: null,
  })
}
